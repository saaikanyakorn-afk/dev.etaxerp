import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, FileText, AlertCircle, RefreshCw } from "lucide-react";

export default function InvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docNo, setDocNo] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const prevUrlRef = useRef<string | null>(null);

  const loadPdf = async () => {
    setLoading(true);
    setError("");
    try {
      const metaRes = await fetch(`/api/share/invoice/${token}`);
      if (!metaRes.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
      const meta = await metaRes.json();
      setDocNo(meta.invoiceNo || "invoice");

      const pdfRes = await fetch(`/api/share/invoice/${token}/pdf`);
      if (!pdfRes.ok) throw new Error("ไม่สามารถสร้าง PDF ได้");
      const blob = await pdfRes.blob();
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevUrlRef.current = url;
      setPdfUrl(url);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPdf();
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
  }, [token]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/share/invoice/${token}/pdf`);
      if (!res.ok) throw new Error("ไม่สามารถสร้าง PDF ได้");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docNo || "invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setDownloading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" /> กำลังโหลด...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
      <AlertCircle className="h-8 w-8 mb-3" />
      <span className="mb-3">{error}</span>
      <Button variant="outline" size="sm" onClick={loadPdf} className="gap-1.5"><RefreshCw className="h-4 w-4" /> ลองใหม่</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{docNo || "ใบแจ้งหนี้"}</span>
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

      <div className="flex-1">
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            style={{ minHeight: "calc(100vh - 52px)", background: "#525659" }}
            title="PDF Preview"
          />
        )}
      </div>
    </div>
  );
}
