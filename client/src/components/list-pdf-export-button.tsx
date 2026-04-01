import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

export interface PdfColumn {
  header: string;
  key: string;
  width?: string;
  align?: "left" | "center" | "right";
  format?: "number" | "text" | "date";
}

interface ListPdfExportButtonProps {
  data: any[];
  columns: PdfColumn[];
  title: string;
  subtitle?: string;
  className?: string;
}

export default function ListPdfExportButton({ data, columns, title, subtitle, className }: ListPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!data.length) return;
    setExporting(true);
    try {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const fmtVal = (val: any, col: PdfColumn) => {
        if (val == null || val === "") return "-";
        if (col.format === "number") {
          const n = parseFloat(String(val));
          return isNaN(n) ? esc(String(val)) : n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return esc(String(val));
      };

      const rows = data.map(row =>
        columns.map(col => {
          const val = col.key.split(".").reduce((o: any, k: string) => o?.[k], row);
          return fmtVal(val, col);
        })
      );

      const safeTitle = esc(title);
      const safeSubtitle = subtitle ? esc(subtitle) : "";

      const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Sarabun', sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
.header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #fb9678; }
.header h1 { font-size: 18px; font-weight: 700; color: #1e293b; }
.header p { font-size: 12px; color: #64748b; margin-top: 4px; }
.meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; color: #64748b; }
table { width: 100%; border-collapse: collapse; }
th { background: #fb9678; color: white; padding: 6px 8px; font-size: 11px; font-weight: 600; text-align: left; white-space: nowrap; }
td { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
tr:nth-child(even) td { background: #f8fafc; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.footer { margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
@media print { body { padding: 12px; } @page { size: A4 landscape; margin: 12mm; } }
</style>
</head><body>
<div class="header">
  <h1>${safeTitle}</h1>
  ${safeSubtitle ? `<p>${safeSubtitle}</p>` : ""}
</div>
<div class="meta">
  <span>จำนวน ${data.length} รายการ</span>
  <span>วันที่พิมพ์: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</span>
</div>
<table>
  <thead><tr>${columns.map(c => `<th class="${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}">${esc(c.header)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((row) => `<tr>${row.map((val, j) => `<td class="${columns[j].align === "right" ? "text-right" : columns[j].align === "center" ? "text-center" : ""}">${val}</td>`).join("")}</tr>`).join("")}</tbody>
</table>
<div class="footer">E-Tax Center — ${safeTitle}</div>
</body></html>`;

      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        setTimeout(() => printWin.print(), 400);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      data-testid="button-export-pdf"
      variant="outline"
      size="sm"
      className={className || "h-9 text-sm px-3 border-blue-500 text-blue-600 hover:bg-blue-50"}
      onClick={handleExport}
      disabled={exporting || !data.length}
    >
      {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
      PDF ({data.length})
    </Button>
  );
}
