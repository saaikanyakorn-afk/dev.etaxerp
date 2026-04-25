import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/layout";

export default function QuotationPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [docNo, setDocNo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quotations/${id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDocNo(d.quotationNo || ""); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/quote")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
        </div>
        <div className="max-w-3xl mx-auto rounded overflow-hidden border border-slate-200">
          <iframe
            src={`/api/documents/quotation/${id}/pdf?view=1`}
            style={{ width: "100%", height: "1050px", border: "none", display: "block" }}
            title={docNo || "Quotation PDF"}
          />
        </div>
      </div>
    </Layout>
  );
}
