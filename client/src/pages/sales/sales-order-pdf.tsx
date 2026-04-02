import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import Layout from "@/components/layout";
import NativePdfViewer from "@/components/native-pdf-viewer";

export default function SalesOrderPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sales-orders/${id}`, { credentials: "include" });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  const handleDownload = () => {
    window.open(`/api/documents/sales_order/${id}/pdf`, "_blank");
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/order")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={handleDownload} variant="outline" size="sm" className="gap-1.5" data-testid="button-download-pdf">
              <Download className="h-4 w-4" /> ดาวน์โหลด PDF
            </Button>
            <Button onClick={() => window.print()} variant="info" className="gap-1.5" data-testid="button-print">
              <Printer className="h-4 w-4" /> สั่งพิมพ์
            </Button>
          </div>
        </div>

        <NativePdfViewer docType="sales_order" docId={Number(id)} />
      </div>
    </Layout>
  );
}
