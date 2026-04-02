import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Layout from "@/components/layout";
import DocumentRenderer from "@/components/document-renderer";
import EDocumentActions from "@/components/e-document-actions";

export default function BillingNotePdf() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>({});
  const [userSig, setUserSig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bnRes, meRes] = await Promise.all([
          fetch(`/api/finance/billing-notes/${id}`, { credentials: "include" }),
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

        if (bnRes.ok) {
          const bn = await bnRes.json();

          const linkedDocs: any[] = bn.linkedDocs || [];
          const items = linkedDocs.map((doc: any, i: number) => ({
            productCode: "",
            productName: doc.docType === "IV" ? "ใบแจ้งหนี้" : doc.docType === "TIV" ? "ใบกำกับภาษี" : doc.docType,
            description: `เลขที่ ${doc.docNo || "-"}${doc.docDate ? ` ลงวันที่ ${doc.docDate}` : ""}`,
            qty: 1,
            unit: "รายการ",
            unitPrice: parseFloat(doc.amount) || 0,
            discount: 0,
            discountType: "amount",
            total: parseFloat(doc.amount) || 0,
          }));

          const totalAmount = parseFloat(bn.totalAmount) || 0;

          const docData = {
            invoiceNo: bn.billingNo,
            invoiceDate: bn.billingDate,
            validUntil: bn.dueDate,
            customerName: bn.customerName,
            customerAddress: bn.customerAddress,
            customerTaxId: bn.customerTaxId,
            subtotal: String(totalAmount),
            vatAmount: "0",
            totalAmount: String(totalAmount),
            withholdingTax: "0",
            notes: bn.notes || "",
            items,
          };

          setData(docData);

          const [cRes, dsRes] = await Promise.all([
            fetch(`/api/companies`, { credentials: "include" }),
            fetch(`/api/document-settings/${bn.companyId}`, { credentials: "include" }),
          ]);

          if (cRes.ok) {
            const companies = await cRes.json();
            setCompany(companies.find((co: any) => co.id === bn.companyId) || null);
          }
          if (dsRes.ok) {
            setDocSettings(await dsRes.json());
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  return (
    <Layout>
      <div className="space-y-4 print:!space-y-0">
        <div className="flex items-center justify-between print:!hidden">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/finance/billing-notes")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()} variant="info" className="gap-1.5" data-testid="button-print">
              <Printer className="h-4 w-4" /> บันทึก PDF / พิมพ์
            </Button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto print:!max-w-none print:!m-0">
          <DocumentRenderer
            settings={docSettings}
            company={company}
            quotation={data}
            documentType="billing_note"
            userSignature={userSig}
          />
        </div>
      </div>
    </Layout>
  );
}
