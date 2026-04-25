import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/layout";
import EDocumentActions from "@/components/e-document-actions";

export default function ReceiptPdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [docNo, setDocNo] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/receipts/${id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setDocNo(d.receiptNo || ""); setCustomerEmail(d.contactEmail || ""); setCustomerName(d.customerName || ""); } })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/receipt")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <EDocumentActions
            documentType="receipt"
            documentId={Number(id)}
            docNo={docNo}
            customerEmail={customerEmail}
            customerName={customerName}
            compact
          />
        </div>
        <div className="max-w-3xl mx-auto rounded overflow-hidden border border-slate-200">
          <iframe
            src={`/api/documents/receipt/${id}/pdf?view=1`}
            style={{ width: "100%", height: "1050px", border: "none", display: "block" }}
            title={docNo || "Receipt PDF"}
          />
        </div>
      </div>
    </Layout>
  );
}
