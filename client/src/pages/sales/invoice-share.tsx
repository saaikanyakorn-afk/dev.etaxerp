import { useState, useEffect } from "react";
import { useParams } from "wouter";
import PdfIframeViewer from "@/components/pdf-iframe-viewer";

export default function InvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const [docNo, setDocNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/invoice/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("ไม่พบเอกสาร หรือลิงก์หมดอายุ"))
      .then(d => setDocNo(d.invoiceNo || "ใบแจ้งหนี้"))
      .catch(e => setError(typeof e === "string" ? e : "ไม่พบเอกสาร"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  const pdfUrl = `/api/share/invoice/${token}/pdf?view=1`;
  const downloadUrl = `/api/share/invoice/${token}/pdf`;

  return (
    <PdfIframeViewer
      pdfUrl={pdfUrl}
      downloadUrl={downloadUrl}
      title={docNo}
      filename={`${docNo}.pdf`}
    />
  );
}
