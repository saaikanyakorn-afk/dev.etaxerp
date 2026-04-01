import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import DocumentRenderer from "@/components/document-renderer";
import { Loader2, FileText, ExternalLink } from "lucide-react";

interface TaxInvoiceHoverPreviewProps {
  taxInvoiceId: number;
  children: React.ReactNode;
}

async function fetchPreviewData(taxInvoiceId: number) {
  const docRes = await fetch(`/api/tax-invoices/${taxInvoiceId}`, { credentials: "include" });
  if (!docRes.ok) throw new Error("Failed to fetch document");
  const doc = await docRes.json();

  const [cRes, dsRes] = await Promise.all([
    fetch(`/api/companies`, { credentials: "include" }),
    fetch(`/api/document-settings/${doc.companyId}`, { credentials: "include" }),
  ]);

  const companies = cRes.ok ? await cRes.json() : [];
  const company = companies.find((co: any) => co.id === doc.companyId) || null;
  const docSettings = dsRes.ok ? await dsRes.json() : {};

  return { doc, company, docSettings };
}

export default function TaxInvoiceHoverPreview({ taxInvoiceId, children }: TaxInvoiceHoverPreviewProps) {
  const [open, setOpen] = useState(false);
  const prefetchTriggered = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tax-invoice-preview", taxInvoiceId],
    queryFn: () => fetchPreviewData(taxInvoiceId),
    enabled: open || prefetchTriggered.current,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleMouseEnter = useCallback(() => {
    prefetchTriggered.current = true;
  }, []);

  const SCALE = 0.55;
  const DOC_WIDTH_PX = 793;
  const PREVIEW_W = Math.round(DOC_WIDTH_PX * SCALE);
  const PREVIEW_H = Math.round(1122 * SCALE);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild onMouseEnter={handleMouseEnter}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="left"
        align="start"
        sideOffset={8}
        className="p-0 shadow-2xl border-0 rounded-xl overflow-hidden"
        style={{ zIndex: 9999, width: PREVIEW_W + 2 }}
      >
        <div className="px-3 py-1.5 flex items-center justify-between border-b bg-green-50">
          <div className="flex items-center gap-1.5 text-green-700">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {data?.doc?.taxInvoiceNo || "ใบกำกับภาษี"}
            </span>
          </div>
          <a
            href={`/sales/tax-invoice/pdf/${taxInvoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-600 hover:text-green-800 flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            เปิดเต็มจอ <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>

        <div className="relative bg-white" style={{ width: PREVIEW_W, height: PREVIEW_H, overflow: "hidden" }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">กำลังโหลดตัวอย่าง...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-400">
              ไม่สามารถโหลดตัวอย่างได้
            </div>
          ) : data ? (
            <div
              style={{
                zoom: SCALE,
                width: DOC_WIDTH_PX,
                pointerEvents: "none",
              }}
            >
              <DocumentRenderer
                settings={data.docSettings}
                company={data.company}
                quotation={data.doc}
                documentType="tax_invoice"
                etaxEnabled={false}
              />
            </div>
          ) : null}

          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{ background: "linear-gradient(transparent, white)" }}
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
