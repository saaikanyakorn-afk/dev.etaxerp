import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import DocumentRenderer from "@/components/document-renderer";

export default function InvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/invoice/${token}`);
        if (!res.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  if (!data) return null;

  const docSettings = data.documentSettings || {};

  return (
    <div className="min-h-screen bg-slate-700 print:bg-white">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{data.invoiceNo || "ใบแจ้งหนี้"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { const prev = document.title; document.title = data?.invoiceNo || "invoice"; window.print(); setTimeout(() => { document.title = prev; }, 1000); }}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4 print:!py-0 print:!px-0 print:!max-w-none print:!m-0 overflow-x-auto">
        <DocumentRenderer
          settings={docSettings}
          company={data.company}
          quotation={data}
          documentType="invoice"
          userSignature={data.userSignature}
        />
      </div>
    </div>
  );
}
