import { useRef, useState } from "react";
import { Printer, Download, Loader2, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfIframeViewerProps {
  pdfUrl: string;
  downloadUrl?: string;
  title?: string;
  filename?: string;
  extraButtons?: React.ReactNode;
  onPrint?: () => void;
}

export default function PdfIframeViewer({
  pdfUrl,
  downloadUrl,
  title,
  filename,
  extraButtons,
  onPrint,
}: PdfIframeViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => {
    if (onPrint) { onPrint(); return; }
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = downloadUrl || pdfUrl;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "document.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert(err.message || "ดาวน์โหลดไม่สำเร็จ");
    }
    setDownloading(false);
  };

  const handleReload = () => {
    setLoading(true);
    setError(false);
    if (iframeRef.current) {
      iframeRef.current.src = pdfUrl;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-700 print:bg-white">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{title || "เอกสาร"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {extraButtons}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[var(--theme-primary)] hover:opacity-90 text-white gap-1.5 h-8 text-xs"
            data-testid="button-download-pdf"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{downloading ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}</span>
            <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-700 z-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            <span className="text-slate-300 text-sm">กำลังสร้าง PDF...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-700 z-10 gap-3">
            <span className="text-red-400 text-sm">ไม่สามารถโหลด PDF ได้</span>
            <Button variant="ghost" size="sm" onClick={handleReload} className="text-slate-300 gap-1.5">
              <RefreshCw className="h-4 w-4" /> ลองใหม่
            </Button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full print:block"
          style={{ height: "calc(100vh - 45px)", border: "none", display: error ? "none" : "block" }}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          title={title || "PDF Viewer"}
        />
      </div>
    </div>
  );
}
