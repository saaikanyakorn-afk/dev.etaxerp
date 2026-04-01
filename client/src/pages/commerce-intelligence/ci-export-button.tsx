import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { ExportColumn, exportToExcel, exportMultiSheetExcel, exportToPdf } from "./ci-export-utils";

interface CIExportButtonProps {
  fileName: string;
  pdfTitle: string;
  kpis?: Array<{ label: string; value: string }>;
  tables: Array<{ title: string; columns: ExportColumn[]; data: any[]; sheetName?: string }>;
  disabled?: boolean;
}

export default function CIExportButton({ fileName, pdfTitle, kpis = [], tables, disabled }: CIExportButtonProps) {
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const hasData = tables.some(t => t.data.length > 0);

  const handleExcel = () => {
    setExporting("excel");
    try {
      if (tables.length === 1) {
        exportToExcel(tables[0].data, tables[0].columns, fileName, tables[0].sheetName || tables[0].title);
      } else {
        exportMultiSheetExcel(
          tables.map(t => ({ name: (t.sheetName || t.title).substring(0, 31), data: t.data, columns: t.columns })),
          fileName
        );
      }
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  };

  const handlePdf = async () => {
    setExporting("pdf");
    try {
      await exportToPdf(pdfTitle, kpis, tables, fileName);
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-sm px-3 border-purple-400 text-purple-600 hover:bg-purple-50"
          disabled={disabled || !hasData || !!exporting}
          data-testid="button-ci-export"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExcel} data-testid="button-ci-export-excel">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} data-testid="button-ci-export-pdf">
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          <span>PDF Report</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
