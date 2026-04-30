import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Loader2, WifiOff, RefreshCw } from "lucide-react";
import Layout from "@/components/layout";
import EDocumentActions from "@/components/e-document-actions";

function ServerErrorScreen({ onRetry, onGoBack }: { onRetry: () => void; onGoBack: () => void }) {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <WifiOff className="h-12 w-12 text-slate-300" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-1">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>
          <p className="text-sm text-slate-500">ไม่สามารถโหลดเอกสารได้ในขณะนี้</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onGoBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> กลับ</Button>
          <Button onClick={onRetry}><RefreshCw className="h-4 w-4 mr-1.5" /> ลองใหม่</Button>
        </div>
      </div>
    </Layout>
  );
}

export default function CreditNotePdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objUrlRef = useRef<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sales-credit-notes/${id}`, { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          setData(d);
        }
      } catch (err: any) {
        if (err.message === "Failed to fetch" || err.message?.includes("NetworkError")) setServerError(true);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = ""; }
    setPdfUrl(null);
    setPdfLoading(true);
    const docNo = data?.creditNoteNo || "credit-note";
    fetch(`/api/documents/credit_note/${id}/pdf`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("สร้าง PDF ไม่สำเร็จ"); return r.blob(); })
      .then(blob => {
        if (cancelled) return;
        objUrlRef.current = URL.createObjectURL(new File([blob], `${docNo}.pdf`, { type: "application/pdf" }));
        setPdfUrl(objUrlRef.current);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => { cancelled = true; };
  }, [id, data?.creditNoteNo]);

  useEffect(() => {
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, []);

  useEffect(() => {
    const no = data?.creditNoteNo;
    if (!no) return;
    const prev = document.title;
    document.title = no;
    return () => { document.title = prev; };
  }, [data?.creditNoteNo]);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${data?.creditNoteNo || "credit-note"}.pdf`;
    a.click();
  };

  if (serverError) {
    return <ServerErrorScreen onRetry={() => { setServerError(false); window.location.reload(); }} onGoBack={() => navigate("/sales/credit-note")} />;
  }

  if (loading) return <Layout><div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
        <div className="space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between py-2 no-print">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/credit-note")}>
              <ArrowLeft className="h-4 w-4" /> กลับ
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} data-testid="button-print">
                <Printer className="h-4 w-4" /> พิมพ์
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={pdfLoading} data-testid="button-download">
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} ดาวน์โหลด
              </Button>
              <EDocumentActions
                documentType="credit_note"
                documentId={Number(id)}
                docNo={data.creditNoteNo}
                customerEmail={data.contactEmail}
                customerName={data.customerName}
                compact
                onDownload={handleDownload}
              />
            </div>
          </div>
        </div>

        {pdfLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : pdfUrl ? (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="flex-1 w-full border-0 rounded mt-2"
            title={data.creditNoteNo}
            data-testid="pdf-iframe"
          />
        ) : null}
      </div>
    </Layout>
  );
}
