import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, FileText, Receipt } from "lucide-react";
import DocumentRenderer from "@/components/document-renderer";

type PrintType = "tax_invoice" | "tax_invoice_receipt" | "invoice" | "delivery_note" | "abbreviated_tax_invoice";

const PRINT_OPTIONS: { key: PrintType; label: string; color: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี", color: "bg-blue-50 border-blue-400 text-blue-700" },
  { key: "tax_invoice_receipt", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", color: "bg-emerald-50 border-emerald-400 text-emerald-700" },
  { key: "invoice", label: "ใบแจ้งหนี้", color: "bg-amber-50 border-amber-400 text-amber-700" },
  { key: "delivery_note", label: "ใบส่งของ", color: "bg-purple-50 border-purple-400 text-purple-700" },
  { key: "abbreviated_tax_invoice", label: "ใบกำกับภาษีอย่างย่อ (80mm)", color: "bg-pink-50 border-pink-400 text-pink-700" },
];

function toBuddhistDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(val: string | number | null | undefined) {
  return parseFloat(String(val || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AbbreviatedTaxInvoice({ data, company }: { data: any; company: any }) {
  const items = data.items || [];
  const subtotal = parseFloat(String(data.subtotal || "0"));
  const vatAmount = parseFloat(String(data.vatAmount || "0"));
  const totalAmount = parseFloat(String(data.totalAmount || "0"));
  const discountAmount = parseFloat(String(data.discountAmount || "0"));

  return (
    <div
      className="receipt-container"
      style={{
        width: "80mm",
        margin: "16px auto",
        padding: "4mm",
        fontFamily: "'Courier New', monospace",
        fontSize: "12px",
        lineHeight: "1.4",
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        border: "1px solid #ddd",
        color: "#000",
      }}
      data-testid="thermal-abbreviated-tax-invoice"
    >
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold" }}>{company?.name || ""}</div>
        {company?.nameEn && <div style={{ fontSize: "10px" }}>{company.nameEn}</div>}
        <div style={{ fontSize: "10px", marginTop: "2px" }}>{company?.address || ""}</div>
        {company?.taxId && <div style={{ fontSize: "10px" }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
        {company?.phone && <div style={{ fontSize: "10px" }}>โทร: {company.phone}</div>}
        <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "4px" }}>ใบกำกับภาษีอย่างย่อ</div>
        <div style={{ fontSize: "10px" }}>ABB. TAX INVOICE</div>
      </div>

      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>เลขที่:</span>
          <span style={{ fontWeight: "bold" }}>{data.taxInvoiceNo}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>วันที่:</span>
          <span>{toBuddhistDate(data.taxInvoiceDate)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>เวลา:</span>
          <span>{formatTime(data.createdAt)}</span>
        </div>
        {data.customerName && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ลูกค้า:</span>
            <span style={{ textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{data.customerName}</span>
          </div>
        )}
        {data.paymentMethod && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ชำระ:</span>
            <span>{data.paymentMethod}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "bold", marginBottom: "4px" }}>
          <span>รายการ</span>
          <span>จำนวนเงิน</span>
        </div>
        {items.map((item: any, idx: number) => {
          const qty = parseFloat(String(item.qty || "0"));
          const price = parseFloat(String(item.unitPrice || "0"));
          const lineTotal = parseFloat(String(item.totalPrice || String(qty * price)));
          return (
            <div key={idx} style={{ marginBottom: "3px" }}>
              <div style={{ fontSize: "11px" }}>{item.productName}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", paddingLeft: "8px" }}>
                <span>{qty} x {formatMoney(price)}</span>
                <span>{formatMoney(lineTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        {items.length > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>รวม ({items.length} รายการ)</span>
            <span>{formatMoney(subtotal + discountAmount)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ส่วนลด</span>
            <span>-{formatMoney(discountAmount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ราคาสินค้า (ก่อน VAT)</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ภาษีมูลค่าเพิ่ม 7%</span>
          <span>{formatMoney(vatAmount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", borderTop: "1px dashed #000", paddingTop: "4px", marginTop: "4px" }}>
          <span>รวมทั้งสิ้น</span>
          <span>{formatMoney(totalAmount)}</span>
        </div>
      </div>

      <div style={{ textAlign: "center", borderTop: "1px dashed #000", paddingTop: "6px", fontSize: "10px" }}>
        <div>ราคารวมภาษีมูลค่าเพิ่มแล้ว</div>
        <div style={{ marginTop: "4px" }}>ขอบคุณที่ใช้บริการ</div>
        <div>Thank you</div>
      </div>
    </div>
  );
}

export default function TaxInvoiceBatchPrint() {
  const [, navigate] = useLocation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>({});
  const [userSig, setUserSig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [printType, setPrintType] = useState<PrintType>("tax_invoice");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get("ids");
    if (!idsParam) {
      setLoading(false);
      return;
    }

    const ids = idsParam.split(",").map(Number).filter(Boolean);
    setProgress({ loaded: 0, total: ids.length });

    (async () => {
      try {
        const [meRes, companiesRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/companies", { credentials: "include" }),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          setUserSig({
            signatureUrl: me.signatureUrl || null,
            signatureName: me.signatureName || me.fullName,
            signatureTitle: me.signatureTitle || null,
          });
        }

        const companies = companiesRes.ok ? await companiesRes.json() : [];

        const results: any[] = [];
        for (let i = 0; i < ids.length; i++) {
          try {
            const res = await fetch(`/api/tax-invoices/${ids[i]}`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              results.push(data);

              if (!company && data.companyId) {
                const comp = companies.find((c: any) => c.id === data.companyId);
                if (comp) setCompany(comp);

                try {
                  const dsRes = await fetch(`/api/document-settings/${data.companyId}`, { credentials: "include" });
                  if (dsRes.ok) setDocSettings(await dsRes.json());
                } catch {}
              }
            }
          } catch {}
          setProgress({ loaded: i + 1, total: ids.length });
        }
        setInvoices(results);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const isThermal = printType === "abbreviated_tax_invoice";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)] mb-4" />
        <p className="text-sm text-slate-500">กำลังโหลดใบกำกับภาษี... ({progress.loaded}/{progress.total})</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <p className="text-sm text-red-500 mb-4">ไม่พบเอกสารที่เลือก</p>
        <Button variant="ghost" onClick={() => window.close()}>ปิดหน้านี้</Button>
      </div>
    );
  }

  function getRenderData(inv: any) {
    const renderData = { ...inv };
    if (printType === "invoice") {
      renderData.invoiceNo = inv.taxInvoiceNo;
      renderData.invoiceDate = inv.taxInvoiceDate;
    } else if (printType === "tax_invoice_receipt") {
      renderData.receiptNo = inv.taxInvoiceNo;
      renderData.receiptDate = inv.taxInvoiceDate;
    } else if (printType === "delivery_note") {
      renderData.orderNo = inv.taxInvoiceNo;
      renderData.orderDate = inv.taxInvoiceDate;
    }
    return renderData;
  }

  return (
    <div className="min-h-screen bg-white">
      {isThermal ? (
        <style>{`
          @media print {
            .no-print { display: none !important; }
            @page { size: 80mm auto; margin: 2mm; }
            body { margin: 0; padding: 0; }
            .receipt-container {
              width: 76mm !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .thermal-page-break { page-break-after: always; }
            .thermal-page-break:last-child { page-break-after: avoid; }
          }
        `}</style>
      ) : (
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-page-break { page-break-after: always; }
            .print-page-break:last-child { page-break-after: avoid; }
            body { margin: 0; padding: 0; }
            @page { margin: 10mm; }
          }
        `}</style>
      )}

      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.close()}>
              <ArrowLeft className="h-4 w-4" /> ปิด
            </Button>
            <span className="text-sm text-slate-500">
              พิมพ์ใบกำกับภาษี {invoices.length} รายการ
            </span>
          </div>
          <Button data-testid="button-print-all" onClick={() => window.print()} className="gap-1.5 bg-[var(--theme-primary)] hover:bg-[#e8734e]">
            <Printer className="h-4 w-4" /> สั่งพิมพ์ทั้งหมด ({invoices.length} ใบ)
          </Button>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-3 flex items-center gap-2 justify-center flex-wrap">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-500 mr-1">รูปแบบพิมพ์:</span>
          {PRINT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              data-testid={`btn-batch-print-type-${opt.key}`}
              onClick={() => setPrintType(opt.key)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                printType === opt.key
                  ? opt.color + " font-semibold shadow-sm"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {opt.key === "abbreviated_tax_invoice" && <Receipt className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isThermal ? (
        <div className="py-4 print:!p-0">
          {invoices.map((inv, idx) => (
            <div
              key={inv.id}
              className={idx < invoices.length - 1 ? "thermal-page-break" : ""}
              data-testid={`batch-invoice-${inv.id}`}
            >
              <div className="no-print text-center py-2 mb-1 text-xs text-slate-400">
                ใบที่ {idx + 1}/{invoices.length} — {inv.taxInvoiceNo}
              </div>
              <AbbreviatedTaxInvoice data={inv} company={company} />
              {idx < invoices.length - 1 && (
                <div className="no-print border-b border-dashed border-slate-200 my-3 mx-auto" style={{ maxWidth: "80mm" }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto py-4 print:!max-w-none print:!m-0 print:!p-0">
          {invoices.map((inv, idx) => (
            <div
              key={inv.id}
              className={idx < invoices.length - 1 ? "print-page-break" : ""}
              data-testid={`batch-invoice-${inv.id}`}
            >
              <div className="no-print text-center py-2 mb-2 bg-slate-50 rounded text-sm text-slate-500">
                ใบที่ {idx + 1}/{invoices.length} — {inv.taxInvoiceNo} — {inv.customerName || "ไม่ระบุลูกค้า"}
              </div>
              <DocumentRenderer
                settings={docSettings}
                company={company}
                quotation={getRenderData(inv)}
                documentType={printType}
                userSignature={userSig}
              />
              {idx < invoices.length - 1 && (
                <div className="no-print border-b-2 border-dashed border-slate-300 my-6" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
