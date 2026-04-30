import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { isAndroid, redirectToChrome } from "@/lib/line-android-redirect";

export default function CreditNoteShare() {
  const { token } = useParams<{ token: string }>();
  const [docNo, setDocNo] = useState("ใบลดหนี้");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objUrlRef = useRef<string>("");
  const android = isAndroid();

  useEffect(() => {
    redirectToChrome();
    (async () => {
      try {
        const infoRes = await fetch(`/api/share/credit-note/${token}`);
        if (!infoRes.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        const d = await infoRes.json();
        const name = d.creditNoteNo || "ใบลดหนี้";
        setDocNo(name);

        const pdfRes = await fetch(`/api/share/credit-note/${token}/pdf`);
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

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      if (pdfUrl) {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `${docNo}.pdf`;
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">กำลังโหลดเอกสาร...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-sm px-4">
          <p className="text-red-500 font-semibold mb-2">ไม่สามารถโหลดเอกสารได้</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="bg-white border-b shadow-sm px-4 py-2 flex items-center justify-between no-print">
        <div>
          <p className="text-xs text-slate-400">ใบลดหนี้</p>
          <p className="font-semibold text-sm">{docNo}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => iframeRef.current?.contentWindow?.print()} className="gap-1.5">
            <Printer className="h-4 w-4" /> พิมพ์
          </Button>
          {!android && (
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="gap-1.5">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} ดาวน์โหลด
            </Button>
          )}
        </div>
      </div>
      {pdfUrl ? (
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="flex-1 w-full border-0"
          style={{ height: "calc(100vh - 56px)" }}
          title={docNo}
        />
      ) : null}
    </div>
  );
}
