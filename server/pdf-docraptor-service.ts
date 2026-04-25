import { renderDocumentHtml } from "./pdf-html-renderer";
import { generatePdfMake } from "./pdf-pdfmake-generator";
import type { GeneratePdfOptions } from "./pdf-react-generator";

const DOCRAPTOR_API_KEY = process.env.DOCRAPTOR_API_KEY || "";
const DOCRAPTOR_TEST_MODE = process.env.DOCRAPTOR_TEST_MODE === "true";

export async function generatePdfDocRaptor(opts: GeneratePdfOptions): Promise<Buffer> {
  if (!DOCRAPTOR_API_KEY) {
    console.warn("[DocRaptor] DOCRAPTOR_API_KEY not set — falling back to pdfmake");
    return generatePdfMake(opts);
  }

  const html = renderDocumentHtml(opts);

  const payload = {
    user_credentials: DOCRAPTOR_API_KEY,
    doc: {
      document_content: html,
      document_type: "pdf",
      name: `${opts.document.docNo || "document"}.pdf`,
      test: DOCRAPTOR_TEST_MODE,
      prince_options: {
        media: "print",
        baseurl: "https://etaxerp.com",
        insecure: false,
      },
    },
  };

  console.log(`[DocRaptor] Generating PDF for ${opts.document.docNo} (test=${DOCRAPTOR_TEST_MODE})`);
  const t0 = Date.now();

  const response = await fetch("https://docraptor.com/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DocRaptor error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`[DocRaptor] Done in ${Date.now() - t0}ms, size=${buffer.length}`);
  return buffer;
}
