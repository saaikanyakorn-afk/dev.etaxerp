import { useState, useEffect } from "react";
import { useParams } from "wouter";
import PdfIframeViewer from "@/components/pdf-iframe-viewer";

export default function SalesOrderShare() {
  const { token } = useParams<{ token: string }>();
  const [docNo, setDocNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/order/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("ไม่พบเอกสาร หรือลิงก์หมดอายุ"))
      .then(d => setDocNo(d.orderNo || "ใบสั่งขาย"))
      .catch(e => setError(typeof e === "string" ? e : "ไม่พบเอกสาร"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  return (
    <PdfIframeViewer
      pdfUrl={`/api/share/sales-order/${token}/pdf?view=1`}
      downloadUrl={`/api/share/sales-order/${token}/pdf`}
      title={docNo}
      filename={`${docNo}.pdf`}
    />
  );
}
