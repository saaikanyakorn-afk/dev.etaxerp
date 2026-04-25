import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function downloadPdfFromElement(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("ไม่พบ element สำหรับสร้าง PDF");

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const a4w = 210;
  const pdfH = Math.round((a4w * canvas.height) / canvas.width);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [a4w, pdfH],
  });

  pdf.addImage(imgData, "JPEG", 0, 0, a4w, pdfH);
  pdf.save(filename);
}
