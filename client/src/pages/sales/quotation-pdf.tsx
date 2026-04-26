import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import Layout from "@/components/layout";

export default function QuotationPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docNo, setDocNo] = useState("quotation");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objUrlRef = useRef<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [docRes, pdfRes] = await Promise.all([
          fetch(`/api/quotations/${id}`, { credentials: "include" }),
          fetch(`/api/documents/quotation/${id}/pdf`, { credentials: "include" }),
        ]);
        if (docRes.ok) {
          const d = await docRes.json();
          setDocNo(d.quotationNo || "quotation");
        }
        if (!pdfRes.ok) throw new Error("สร้าง PDF ไม่สำเร็จ");
        const blob = await pdfRes.blob();
        objUrlRef.current = URL.createObjectURL(blob);
        setPdfUrl(objUrlRef.current);
      } catch (err: any) {
        setError(err.message || "เกิดข้อผิดพลาด");
      }
      setLoading(false);
    })();
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, [id]);

  const handlePrint = () => iframeRef.current?.contentWindow?.print();
  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${docNo}.pdf`;
    a.click();
  };

  if (loading) return <Layout><div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></Layout>;
  if (error) return <Layout><div className="text-center py-12 text-red-500">{error}</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex items-center justify-between py-2 flex-shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/quote")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
            <Button variant="info" size="sm" className="gap-1.5" onClick={handleDownload} data-testid="button-download">
              <Download className="h-4 w-4" /> ดาวน์โหลด PDF
            </Button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src={pdfUrl!}
          className="flex-1 w-full border-0 rounded"
          title={docNo}
          data-testid="pdf-iframe"
        />
      </div>
    </Layout>
  );
}
