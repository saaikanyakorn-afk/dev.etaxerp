import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: "number" | "text" | "date";
}

interface ListExportButtonProps {
  data: any[];
  columns: ExcelColumn[];
  fileName: string;
  sheetName?: string;
  className?: string;
}

export default function ListExportButton({ data, columns, fileName, sheetName = "Sheet1", className }: ListExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!data.length) return;
    setExporting(true);
    try {
      const headers = columns.map(c => c.header);
      const rows = data.map(row =>
        columns.map(col => {
          const val = col.key.split(".").reduce((o: any, k: string) => o?.[k], row);
          if (val == null) return "";
          if (col.format === "number") {
            const n = parseFloat(String(val));
            return isNaN(n) ? val : n;
          }
          return String(val);
        })
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = columns.map(c => ({ wch: c.width || 18 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      data-testid="button-export-excel"
      variant="outline"
      size="sm"
      className={className || "h-9 text-sm px-3 border-emerald-500 text-emerald-600 hover:bg-emerald-50"}
      onClick={handleExport}
      disabled={exporting || !data.length}
    >
      {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
      Excel ({data.length})
    </Button>
  );
}
