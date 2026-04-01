import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";
import { FileText, Receipt, FileCheck, ShoppingCart, ClipboardList, ExternalLink, Edit } from "lucide-react";

interface RelatedDoc {
  type: string;
  id: number;
  docNo: string;
  date: string;
  status: string;
  totalAmount: string;
}

const docTypeConfig: Record<string, { label: string; icon: any; color: string; editPath: string; viewPath: string }> = {
  quotation: { label: "ใบเสนอราคา", icon: ClipboardList, color: "#fec90f", editPath: "/sales/quote/edit/", viewPath: "/sales/quote/pdf/" },
  sales_order: { label: "ใบสั่งขาย", icon: ShoppingCart, color: "#fb9678", editPath: "/sales/order/edit/", viewPath: "/sales/order/pdf/" },
  invoice: { label: "ใบแจ้งหนี้", icon: FileText, color: "#05b187", editPath: "/sales/invoice/edit/", viewPath: "/sales/invoice/pdf/" },
  tax_invoice: { label: "ใบกำกับภาษี", icon: FileCheck, color: "var(--theme-primary)", editPath: "/sales/tax-invoice/edit/", viewPath: "/sales/tax-invoice/pdf/" },
  receipt: { label: "ใบเสร็จรับเงิน", icon: Receipt, color: "#03c9d7", editPath: "/sales/receipt/edit/", viewPath: "/sales/receipt/pdf/" },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "#94a3b8" },
  approved: { label: "อนุมัติ", color: "#05b187" },
  sent: { label: "ส่งแล้ว", color: "var(--theme-primary)" },
  paid: { label: "ชำระแล้ว", color: "#05b187" },
  cancelled: { label: "ยกเลิก", color: "#f94d4d" },
  voided: { label: "ยกเลิก", color: "#f94d4d" },
  accepted: { label: "ตอบรับ", color: "#05b187" },
  rejected: { label: "ปฏิเสธ", color: "#f94d4d" },
  pending: { label: "รออนุมัติ", color: "#fec90f" },
  partial: { label: "บางส่วน", color: "#fec90f" },
};

export default function RelatedDocuments({ docType, docId }: { docType: string; docId: number | null }) {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: related = [], isLoading } = useQuery<RelatedDoc[]>({
    queryKey: ["/api/related-documents", docType, docId, companyId],
    queryFn: async () => {
      if (!docId || !companyId) return [];
      const res = await fetch(`/api/related-documents/${docType}/${docId}?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!docId && !!companyId,
  });

  if (!docId || isLoading || related.length === 0) return null;

  return (
    <div data-testid="related-documents-panel" className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <ExternalLink className="w-4 h-4" />
        เอกสารที่เกี่ยวข้อง
      </h3>
      <div className="space-y-2">
        {related.map((doc, idx) => {
          const config = docTypeConfig[doc.type];
          if (!config) return null;
          const Icon = config.icon;
          const statusInfo = statusLabels[doc.status] || { label: doc.status, color: "#94a3b8" };

          return (
            <div
              key={`${doc.type}-${doc.id}-${idx}`}
              data-testid={`related-doc-${doc.type}-${doc.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: config.color + "20" }}
                >
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{config.label}</div>
                  <div className="text-sm font-medium text-gray-800 truncate">{doc.docNo}</div>
                </div>
                <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{formatShortDate(doc.date)}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700">{fmt(doc.totalAmount)}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: statusInfo.color + "20", color: statusInfo.color }}
                >
                  {statusInfo.label}
                </span>
                <div className="flex gap-1">
                  <button
                    data-testid={`edit-related-${doc.type}-${doc.id}`}
                    onClick={() => navigate(config.editPath + doc.id)}
                    className="p-1.5 rounded-md hover:bg-white transition-colors"
                    title="แก้ไข"
                  >
                    <Edit className="w-3.5 h-3.5 text-gray-500 hover:text-[#fb9678]" />
                  </button>
                  <button
                    data-testid={`view-related-${doc.type}-${doc.id}`}
                    onClick={() => navigate(config.viewPath + doc.id)}
                    className="p-1.5 rounded-md hover:bg-white transition-colors"
                    title="ดู"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-500 hover:text-[var(--theme-primary)]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
