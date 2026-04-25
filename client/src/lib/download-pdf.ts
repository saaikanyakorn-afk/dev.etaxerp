import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function downloadSharePdf(docType: string, token: string, filename: string, query?: string): Promise<void> {
  const res = await fetch(`/api/share/${docType}/${token}/pdf${query ? `?${query}` : ""}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "สร้าง PDF ไม่สำเร็จ");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

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
