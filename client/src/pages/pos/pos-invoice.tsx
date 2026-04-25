import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

type PrintType = "tax_invoice" | "tax_invoice_receipt";

const PRINT_OPTIONS: { key: PrintType; label: string; color: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี", color: "bg-blue-50 border-blue-400 text-blue-700" },
  { key: "tax_invoice_receipt", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", color: "bg-emerald-50 border-emerald-400 text-emerald-700" },
];

export default function PosInvoice() {
  const { id } = useParams<{ id: string }>();
  const [docId, setDocId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState<PrintType>("tax_invoice");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const companiesRes = await fetch("/api/companies", { credentials: "include" });
        if (!companiesRes.ok) return;
        const companies = await companiesRes.json();

        for (const co of companies) {
          const docRes = await fetch(`/api/pos/sales/${id}?companyId=${co.id}`, { credentials: "include" });
          if (docRes.ok) {
            const d = await docRes.json();
            setDocId(d.id);
            break;
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const pdfUrl = docId
    ? `/api/documents/tax_invoice/${docId}/pdf${printType !== "tax_invoice" ? `?printType=${printType}` : ""}`
    : "";

  if (loading) return <div className="text-center py-12 text-slate-500">กำลังโหลด...</div>;
  if (!docId) return <div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div>;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:!hidden bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.history.back()} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-500 mr-1">รูปแบบ:</span>
            {PRINT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                data-testid={`btn-print-type-${opt.key}`}
                onClick={() => setPrintType(opt.key)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                  printType === opt.key
                    ? opt.color + " font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center print:!block print:!m-0">
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full max-w-3xl border-0"
          style={{ height: "calc(100vh - 56px)" }}
          title="POS Invoice PDF"
        />
      </div>
    </div>
  );
}
