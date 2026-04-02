import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, FileText, Receipt, FlaskConical, Loader2, CheckCircle2, AlertCircle, Activity, WifiOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout";
import DocumentRenderer from "@/components/document-renderer";
import EDocumentActions from "@/components/e-document-actions";

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
          const priceIncVat = parseFloat(String(item.unitPrice || "0"));
          const vatType = item.vatType || "vat7";
          const priceExVat = vatType === "vat7" ? Math.round((priceIncVat * 100 / 107) * 100) / 100 : priceIncVat;
          const lineTotalIncVat = parseFloat(String(item.totalPrice || String(qty * priceIncVat)));
          const lineTotalExVat = vatType === "vat7" ? Math.round((lineTotalIncVat * 100 / 107) * 100) / 100 : lineTotalIncVat;
          return (
            <div key={idx} style={{ marginBottom: "3px" }}>
              <div style={{ fontSize: "11px" }}>{item.productName}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", paddingLeft: "8px" }}>
                <span>{qty} x {formatMoney(priceExVat)}</span>
                <span>{formatMoney(lineTotalExVat)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        {items.length > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>รวม ({items.length} รายการ)</span>
            <span>{formatMoney(totalAmount)}</span>
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
          <span>{formatMoney(totalAmount - vatAmount)}</span>
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

function ServerErrorScreen({ onRetry, onGoBack }: { onRetry: () => void; onGoBack: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleRetry = async () => {
    setRetrying(true);
    setCountdown(5);
    const timer = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
    try {
      const resp = await fetch("/api/auth/me", { credentials: "include" });
      if (resp.ok) {
        clearInterval(timer);
        onRetry();
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 5000));
    setRetrying(false);
    try {
      const resp2 = await fetch("/api/auth/me", { credentials: "include" });
      if (resp2.ok) { onRetry(); return; }
    } catch {}
  };

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="server-error-screen">
        <div className="text-center max-w-lg mx-auto px-6 py-12">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <WifiOff className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</h1>
          <p className="text-gray-600 mb-2">ระบบไม่สามารถติดต่อเซิร์ฟเวอร์ได้ในขณะนี้</p>
          <p className="text-gray-500 text-sm mb-8">อาจเกิดจากการขาดการเชื่อมต่ออินเทอร์เน็ต หรือเซิร์ฟเวอร์กำลังรีสตาร์ท กรุณารอสักครู่แล้วลองใหม่</p>
          
          <div className="space-y-3">
            <Button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full bg-[#fb9678] hover:bg-[#e8856a] text-white h-12 text-base"
              data-testid="btn-retry-connection"
            >
              {retrying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  กำลังเชื่อมต่อใหม่... {countdown > 0 && `(${countdown})`}
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  ลองเชื่อมต่อใหม่
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onGoBack}
              className="w-full h-12 text-base"
              data-testid="btn-go-back"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              กลับหน้าหลัก
            </Button>
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
            <p className="text-sm font-semibold text-amber-800 mb-2">สิ่งที่ควรตรวจสอบ:</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>สาย LAN / WiFi เชื่อมต่ออยู่หรือไม่</li>
              <li>เซิร์ฟเวอร์อาจกำลังรีสตาร์ท — รอ 30 วินาทีแล้วลองใหม่</li>
              <li>ลองเปิดหน้าเว็บใหม่ (รีเฟรชหน้าจอ)</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function TaxInvoicePdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>({});
  const [userSig, setUserSig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState<PrintType>("tax_invoice");
  const [serverError, setServerError] = useState(false);

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<any>(null);
  const [demoElapsed, setDemoElapsed] = useState(0);

  const runDemo = useCallback(async () => {
    setDemoRunning(true);
    setDemoResult(null);
    setDemoElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setDemoElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    try {
      const resp = await fetch("/api/pdf/demo-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      clearInterval(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      setDemoResult(result);
    } catch (err: any) {
      clearInterval(timer);
      if (err.message === "Failed to fetch" || err.message?.includes("NetworkError")) {
        setServerError(true);
      }
      setDemoResult({ success: false, message: err.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setDemoRunning(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [docRes, meRes] = await Promise.all([
          fetch(`/api/tax-invoices/${id}`, { credentials: "include" }),
          fetch(`/api/auth/me`, { credentials: "include" }),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          setUserSig({
            signatureUrl: me.signatureUrl || null,
            signatureName: me.signatureName || me.fullName,
            signatureTitle: me.signatureTitle || null,
          });
        }

        if (docRes.ok) {
          const d = await docRes.json();
          setData(d);

          const [cRes, dsRes] = await Promise.all([
            fetch(`/api/companies`, { credentials: "include" }),
            fetch(`/api/document-settings/${d.companyId}`, { credentials: "include" }),
          ]);

          if (cRes.ok) {
            const companies = await cRes.json();
            setCompany(companies.find((co: any) => co.id === d.companyId) || null);
          }
          if (dsRes.ok) {
            setDocSettings(await dsRes.json());
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (serverError) {
    return (
      <ServerErrorScreen
        onRetry={() => { setServerError(false); window.location.reload(); }}
        onGoBack={() => navigate("/sales/tax-invoice")}
      />
    );
  }

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  const isThermal = printType === "abbreviated_tax_invoice";

  const renderData = { ...data };
  if (printType === "invoice") {
    renderData.invoiceNo = data.taxInvoiceNo;
    renderData.invoiceDate = data.taxInvoiceDate;
  } else if (printType === "tax_invoice_receipt") {
    renderData.receiptNo = data.taxInvoiceNo;
    renderData.receiptDate = data.taxInvoiceDate;
  } else if (printType === "delivery_note") {
    renderData.orderNo = data.taxInvoiceNo;
    renderData.orderDate = data.taxInvoiceDate;
  }

  return (
    <Layout>
      {isThermal && (
        <style>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 2mm;
            }
            body { margin: 0; padding: 0; }
            .no-print, nav, aside, header, [data-sidebar], [class*="sidebar"] { display: none !important; }
            .receipt-container { 
              width: 76mm !important; 
              margin: 0 !important; 
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            main { padding: 0 !important; margin: 0 !important; }
          }
        `}</style>
      )}
      <div className="space-y-4 print:!space-y-0">
        <div className="flex items-center justify-between print:!hidden no-print">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/tax-invoice")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <EDocumentActions
              documentType="tax_invoice"
              documentId={Number(id)}
              docNo={data.taxInvoiceNo}
              customerEmail={data.contactEmail}
              customerName={data.customerName}
              compact
              showFormTypeSelector
            />
            <Button onClick={() => window.print()} variant="info" className="gap-1.5">
              <Printer className="h-4 w-4" /> สั่งพิมพ์
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center flex-wrap print:!hidden no-print">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-500 mr-1">รูปแบบพิมพ์:</span>
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
              {opt.key === "abbreviated_tax_invoice" && <Receipt className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />}
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 max-w-3xl mx-auto print:!hidden no-print" data-testid="demo-pdf-panel">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">ทดสอบ Demo PDF</span>
              <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-[10px]">สร้าง PDF จริง 50 รายการ</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={runDemo}
                disabled={demoRunning}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="btn-demo-pdf"
              >
                {demoRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    กำลังสร้าง PDF... ({demoElapsed} วินาที)
                  </>
                ) : (
                  <>
                    <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                    เริ่มทดสอบ
                  </>
                )}
              </Button>
              {demoResult && (
                <div className="flex items-center gap-1.5">
                  {demoResult.success ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> สำเร็จ {demoResult.stats?.elapsedSec}s
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" /> ล้มเหลว
                    </Badge>
                  )}
                  {demoResult.stats && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Activity className="h-3 w-3" />
                      {demoResult.stats.pdfSizeKB}KB | RAM {demoResult.stats.memoryBeforeMB}→{demoResult.stats.memoryAfterMB}MB
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isThermal ? (
          <AbbreviatedTaxInvoice data={data} company={company} />
        ) : (
          <div className="max-w-3xl mx-auto print:!max-w-none print:!m-0">
            <DocumentRenderer
              settings={docSettings}
              company={company}
              quotation={renderData}
              documentType={printType}
              userSignature={userSig}
              etaxEnabled={false}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
