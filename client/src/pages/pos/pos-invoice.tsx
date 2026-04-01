import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import DocumentRenderer from "@/components/document-renderer";

type PrintType = "tax_invoice" | "tax_invoice_receipt";

const PRINT_OPTIONS: { key: PrintType; label: string; color: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี", color: "bg-blue-50 border-blue-400 text-blue-700" },
  { key: "tax_invoice_receipt", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", color: "bg-emerald-50 border-emerald-400 text-emerald-700" },
];

export default function PosInvoice() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState<PrintType>("tax_invoice");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meRes.ok) return;

        const companiesRes = await fetch("/api/companies", { credentials: "include" });
        if (!companiesRes.ok) return;
        const companies = await companiesRes.json();
        if (!companies.length) return;

        let d: any = null;
        for (const co of companies) {
          const docRes = await fetch(`/api/pos/sales/${id}?companyId=${co.id}`, { credentials: "include" });
          if (docRes.ok) {
            d = await docRes.json();
            break;
          }
        }
        if (!d) return;
        setData(d);
        setCompany(companies.find((co: any) => co.id === d.companyId) || companies[0]);

        const dsRes = await fetch(`/api/document-settings/${d.companyId}`, { credentials: "include" });
        if (dsRes.ok) setDocSettings(await dsRes.json());
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="text-center py-12 text-slate-500">กำลังโหลด...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div>;

  const renderData = { ...data };
  if (printType === "tax_invoice_receipt") {
    renderData.receiptNo = data.taxInvoiceNo;
    renderData.receiptDate = data.taxInvoiceDate;
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:!hidden bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.history.back()} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
          </Button>
          <div className="flex items-center gap-2">
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
            <Button onClick={() => window.print()} className="gap-1.5 bg-[#fb9678] hover:bg-[#fb9678]/90" data-testid="btn-print">
              <Printer className="h-4 w-4" /> สั่งพิมพ์
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 print:!max-w-none print:!m-0 print:!p-0">
        <DocumentRenderer
          settings={docSettings}
          company={company}
          quotation={renderData}
          documentType={printType}
        />
      </div>
    </div>
  );
}
