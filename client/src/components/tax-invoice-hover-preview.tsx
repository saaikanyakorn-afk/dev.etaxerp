import { useState, useCallback } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { FileText, ExternalLink } from "lucide-react";

interface TaxInvoiceHoverPreviewProps {
  taxInvoiceId: number;
  children: React.ReactNode;
}

export default function TaxInvoiceHoverPreview({ taxInvoiceId, children }: TaxInvoiceHoverPreviewProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const SCALE = 0.55;
  const DOC_WIDTH_PX = 793;
  const DOC_HEIGHT_PX = 1122;
  const PREVIEW_W = Math.round(DOC_WIDTH_PX * SCALE);
  const PREVIEW_H = Math.round(DOC_HEIGHT_PX * SCALE);

  const pdfUrl = `/api/documents/tax_invoice/${taxInvoiceId}/pdf`;

  const handleOpenChange = useCallback((o: boolean) => {
    setOpen(o);
    if (!o) setLoaded(false);
  }, []);

  return (
    <HoverCard open={open} onOpenChange={handleOpenChange} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
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
            <span className="text-xs font-medium">ใบกำกับภาษี</span>
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
          {open && (
            <iframe
              src={pdfUrl}
              onLoad={() => setLoaded(true)}
              style={{
                width: DOC_WIDTH_PX,
                height: DOC_HEIGHT_PX,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
                border: "none",
                pointerEvents: "none",
                display: "block",
              }}
              title="PDF Preview"
            />
          )}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <span className="text-xs text-slate-400">กำลังโหลด...</span>
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{ background: "linear-gradient(transparent, white)" }}
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
