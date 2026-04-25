import { useState, useEffect } from "react";
import { useParams } from "wouter";
import PdfIframeViewer from "@/components/pdf-iframe-viewer";

const FORM_LABELS: Record<string, string> = {
  tax_invoice: "ใบกำกับภาษี",
  tax_invoice_receipt: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  delivery_note: "ใบส่งของ",
};

export default function TaxInvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const [docNo, setDocNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = new URLSearchParams(window.location.search);
  const printType = params.get("printType") || "tax_invoice";

  useEffect(() => {
    fetch(`/api/share/tax-invoice/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("ไม่พบเอกสาร หรือลิงก์หมดอายุ"))
      .then(d => setDocNo(d.taxInvoiceNo || FORM_LABELS[printType] || "ใบกำกับภาษี"))
      .catch(e => setError(typeof e === "string" ? e : "ไม่พบเอกสาร"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  const qs = printType ? `&printType=${printType}` : "";
  const pdfUrl = `/api/share/tax-invoice/${token}/pdf?view=1${qs}`;
  const downloadUrl = `/api/share/tax-invoice/${token}/pdf${printType ? `?printType=${printType}` : ""}`;

  return (
    <PdfIframeViewer
      pdfUrl={pdfUrl}
      downloadUrl={downloadUrl}
      title={docNo}
      filename={`${docNo}.pdf`}
    />
  );
}
