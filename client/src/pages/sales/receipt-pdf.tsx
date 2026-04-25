import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/layout";
import EDocumentActions from "@/components/e-document-actions";

export default function ReceiptPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pdfUrl = `/api/documents/receipt/${id}/pdf`;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/receipts/${id}`, { credentials: "include" });
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
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/receipt")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <EDocumentActions
            documentType="receipt"
            documentId={Number(id)}
            docNo={data.receiptNo}
            customerEmail={data.contactEmail}
            customerName={data.customerName}
            compact
          />
        </div>
        <div className="w-full print:!block" style={{ height: "calc(100vh - 80px)" }}>
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Receipt PDF"
          />
        </div>
      </div>
    </Layout>
  );
}
