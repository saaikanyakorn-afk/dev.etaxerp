import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Layout from "@/components/layout";
import DocumentRenderer from "@/components/document-renderer";
import EDocumentActions from "@/components/e-document-actions";

export default function InvoicePdf() {
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
        const [docRes, meRes] = await Promise.all([
          fetch(`/api/invoices/${id}`, { credentials: "include" }),
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

  if (loading) return <Layout><div className="text-center py-12 text-slate-500">กำลังโหลด...</div></Layout>;
  if (!data) return <Layout><div className="text-center py-12 text-red-500">ไม่พบเอกสาร</div></Layout>;

  return (
    <Layout>
      <div className="space-y-4 print:!space-y-0">
        <div className="flex items-center justify-between print:!hidden">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/sales/invoice")}>
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <EDocumentActions
              documentType="invoice"
              documentId={Number(id)}
              docNo={data.invoiceNo}
              customerEmail={data.contactEmail}
              customerName={data.customerName}
              compact
            />
            <Button onClick={() => window.print()} variant="info" className="gap-1.5">
              <Printer className="h-4 w-4" /> สั่งพิมพ์
            </Button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto print:!max-w-none print:!m-0">
          <DocumentRenderer
            settings={docSettings}
            company={company}
            quotation={data}
            documentType="invoice"
            userSignature={userSig}
          />
        </div>
      </div>
    </Layout>
  );
}
