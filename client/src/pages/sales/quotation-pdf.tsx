import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import Layout from "@/components/layout";

export default function QuotationPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pdfUrl = `/api/documents/quotation/${id}/pdf`;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${id}`, { credentials: "include" });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  return (
    <Layout>
      <div className="space-y-3 print:!space-y-0">
        <div className="flex items-center justify-between print:!hidden">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/quote")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => iframeRef.current?.contentWindow?.print()}
              data-testid="button-print"
            >
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
            <a href={pdfUrl} download={`${data.quotationNo || "quotation"}.pdf`}>
              <Button variant="info" size="sm" className="gap-1.5" data-testid="button-download">
                <Download className="h-4 w-4" /> บันทึก PDF
              </Button>
            </a>
          </div>
        </div>
        <div className="w-full print:!block" style={{ height: "calc(100vh - 80px)" }}>
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Quotation PDF"
          />
        </div>
      </div>
    </Layout>
  );
}
