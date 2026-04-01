import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: "number" | "money" | "percent" | "text";
}

function resolveValue(row: any, key: string): any {
  return key.split(".").reduce((o: any, k: string) => o?.[k], row);
}

function formatCellValue(val: any, format?: string): string | number {
  if (val == null) return "";
  if (format === "money") {
    const n = parseFloat(String(val));
    return isNaN(n) ? val : n;
  }
  if (format === "number") {
    const n = parseFloat(String(val));
    return isNaN(n) ? val : n;
  }
  if (format === "percent") {
    const n = parseFloat(String(val));
    return isNaN(n) ? val : `${n.toFixed(2)}%`;
  }
  return String(val);
}

export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  fileName: string,
  sheetName = "Sheet1"
) {
  if (!data.length) return;
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => formatCellValue(resolveValue(row, col.key), col.format))
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = columns.map(c => ({ wch: c.width || 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportMultiSheetExcel(
  sheets: Array<{ name: string; data: any[]; columns: ExportColumn[] }>,
  fileName: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (!sheet.data.length) continue;
    const headers = sheet.columns.map(c => c.header);
    const rows = sheet.data.map(row =>
      sheet.columns.map(col => formatCellValue(resolveValue(row, col.key), col.format))
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = sheet.columns.map(c => ({ wch: c.width || 18 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

const THAI_TO_EN: Record<string, string> = {
  "รายได้": "Revenue",
  "กำไร": "Profit",
  "ค่าโฆษณา": "Ad Spend",
  "จำนวนออเดอร์": "Orders",
  "วิกฤต": "Critical",
  "เตือน": "Warning",
  "แนะนำ": "Suggestion",
  "ทั้งหมด": "Total",
  "สต็อกใกล้หมด": "Low Stock",
};

function toSafeText(text: string, useThaiFont: boolean): string {
  if (useThaiFont) return text;
  const mapped = THAI_TO_EN[text];
  if (mapped) return mapped;
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function exportToPdf(
  title: string,
  kpis: Array<{ label: string; value: string }>,
  tables: Array<{ title: string; columns: ExportColumn[]; data: any[] }>,
  fileName: string
) {
  const pdfDoc = await PDFDocument.create();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const useThaiFont = false;

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawText = (text: string, x: number, yPos: number, size: number, f = font, color = rgb(0, 0, 0)) => {
    const safe = toSafeText(text, useThaiFont);
    try {
      currentPage.drawText(safe, { x, y: yPos, size, font: f, color });
    } catch {
      const fallback = safe.replace(/[^\x20-\x7E]/g, "");
      if (fallback) currentPage.drawText(fallback, { x, y: yPos, size, font: f, color });
    }
  };

  const drawTableHeaders = (cols: ExportColumn[], colW: number, rowH: number) => {
    currentPage.drawRectangle({
      x: margin,
      y: y - rowH + 4,
      width: contentWidth,
      height: rowH,
      color: rgb(0.486, 0.227, 0.929),
    });
    for (let c = 0; c < cols.length; c++) {
      drawText(cols[c].header, margin + c * colW + 4, y - 10, 7.5, fontBold, rgb(1, 1, 1));
    }
    y -= rowH;
  };

  drawText("Commerce Intelligence Report", margin, y, 18, fontBold, rgb(0.486, 0.227, 0.929));
  y -= 20;
  drawText(title, margin, y, 12, font, rgb(0.4, 0.4, 0.4));
  y -= 10;

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  drawText(`Generated: ${dateStr}`, margin, y, 9, font, rgb(0.5, 0.5, 0.5));
  y -= 25;

  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 20;

  if (kpis.length > 0) {
    const kpiPerRow = 4;
    const kpiBoxW = contentWidth / kpiPerRow;
    const kpiBoxH = 45;

    for (let i = 0; i < kpis.length; i++) {
      const col = i % kpiPerRow;
      const row = Math.floor(i / kpiPerRow);

      if (row > 0 && col === 0 && y - kpiBoxH < margin) addNewPage();

      const bx = margin + col * kpiBoxW;
      const by = y - row * kpiBoxH;

      currentPage.drawRectangle({
        x: bx + 2,
        y: by - kpiBoxH + 5,
        width: kpiBoxW - 4,
        height: kpiBoxH - 4,
        color: rgb(0.97, 0.97, 0.99),
        borderColor: rgb(0.9, 0.9, 0.92),
        borderWidth: 0.5,
      });

      drawText(kpis[i].label, bx + 8, by - 14, 8, font, rgb(0.5, 0.5, 0.5));
      drawText(kpis[i].value, bx + 8, by - 30, 13, fontBold, rgb(0.15, 0.15, 0.15));

      if (i === kpis.length - 1) {
        y -= (row + 1) * kpiBoxH + 15;
      }
    }
  }

  for (const table of tables) {
    if (!table.data.length) continue;

    if (y < margin + 60) addNewPage();

    drawText(table.title, margin, y, 11, fontBold, rgb(0.2, 0.2, 0.2));
    y -= 18;

    const cols = table.columns;
    const colCount = cols.length;
    const colW = contentWidth / colCount;
    const rowH = 18;

    drawTableHeaders(cols, colW, rowH);

    const maxRows = Math.min(table.data.length, 50);
    for (let r = 0; r < maxRows; r++) {
      if (y - rowH < margin) {
        addNewPage();
        drawTableHeaders(cols, colW, rowH);
      }

      if (r % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: y - rowH + 4,
          width: contentWidth,
          height: rowH,
          color: rgb(0.98, 0.98, 0.99),
        });
      }

      const row = table.data[r];
      for (let c = 0; c < colCount; c++) {
        const val = formatCellValue(resolveValue(row, cols[c].key), cols[c].format);
        let cellText = String(val);
        if (cellText.length > 30) cellText = cellText.substring(0, 27) + "...";
        drawText(cellText, margin + c * colW + 4, y - 10, 7, font, rgb(0.25, 0.25, 0.25));
      }
      y -= rowH;
    }

    if (table.data.length > 50) {
      drawText(`... and ${table.data.length - 50} more rows`, margin, y - 10, 7, font, rgb(0.5, 0.5, 0.5));
      y -= 18;
    }

    y -= 15;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
