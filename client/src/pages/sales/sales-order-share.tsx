import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2, FileText } from "lucide-react";
import { redirectIfLineWebview, isLineWebview } from "@/lib/line-android-redirect";

export default function SalesOrderShare() {
  const { token } = useParams<{ token: string }>();
  const [docNo, setDocNo] = useState("ใบสั่งขาย");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objUrlRef = useRef<string>("");

  useEffect(() => {
    if (redirectIfLineWebview()) {
      setRedirected(true);
      return;
    }
    (async () => {
      try {
        const infoRes = await fetch(`/api/share/order/${token}`);
        if (!infoRes.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        const d = await infoRes.json();
        const name = d.orderNo || d.salesOrderNo || "ใบสั่งขาย";
        setDocNo(name);

        const pdfRes = await fetch(`/api/share/sales-order/${token}/pdf`);
        if (!pdfRes.ok) throw new Error("สร้าง PDF ไม่สำเร็จ");
        const blob = await pdfRes.blob();
        objUrlRef.current = URL.createObjectURL(new File([blob], `${name}.pdf`, { type: "application/pdf" }));
        setPdfUrl(objUrlRef.current);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, [token]);

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

  if (redirected) return <div className="flex items-center justify-center min-h-screen text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />กำลังเปิดใน Chrome...</div>;
  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  const lineAndroid = isLineWebview();

  return (
    <div className="flex flex-col min-h-screen bg-slate-700">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{docNo}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!lineAndroid && (
            <Button variant="ghost" size="sm" onClick={handlePrint} className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs" data-testid="button-print">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">พิมพ์</span>
            </Button>
          )}
          <Button size="sm" onClick={handleDownload} disabled={downloading} className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs" data-testid="button-download-pdf">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{downloading ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}</span>
            <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </div>

      {lineAndroid ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8">
          <FileText className="h-20 w-20 text-slate-400" />
          <div className="text-center">
            <div className="text-white text-lg font-medium mb-1">{docNo}</div>
            <div className="text-slate-400 text-sm">กดปุ่มด้านล่างเพื่อดาวน์โหลดไฟล์ PDF</div>
          </div>
          <Button size="lg" onClick={handleDownload} disabled={downloading} className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-2 px-8 py-3 text-base" data-testid="button-download-pdf-android">
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {downloading ? "กำลังโหลด..." : "ดาวน์โหลด PDF"}
          </Button>
        </div>
      ) : (
        <iframe ref={iframeRef} src={pdfUrl!} className="flex-1 w-full border-0" title={docNo} data-testid="pdf-iframe" />
      )}
    </div>
  );
}
