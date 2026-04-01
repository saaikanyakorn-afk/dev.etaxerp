import { type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import { quotations, invoices, taxInvoices, receipts, salesOrders, companies, whiteLabelSettings, contracts } from "@shared/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";

const BOT_RE = /bot|crawler|spider|preview|line|facebook|twitter|telegram|slack|whatsapp|discord|linkedin|pinterest|facebookexternalhit|twitterbot|slackbot/i;

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const DOC_TYPE_COLORS: Record<string, { bg: string; accent: string; icon: string }> = {
  quote:         { bg: "#fef3c7", accent: "#d97706", icon: "QO" },
  invoice:       { bg: "#d1fae5", accent: "#059669", icon: "IV" },
  "tax-invoice": { bg: "#dbeafe", accent: "#2563eb", icon: "TX" },
  receipt:       { bg: "#e0f2fe", accent: "#0284c7", icon: "RC" },
  order:         { bg: "#fce7f3", accent: "#db2777", icon: "SO" },
  contract:      { bg: "#ede9fe", accent: "#7c3aed", icon: "CT" },
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function generateOgSvg(opts: {
  docLabel: string;
  docNo: string;
  companyName: string;
  customerName: string;
  amount: string;
  amountLabel: string;
  docType: string;
}): string {
  const colors = DOC_TYPE_COLORS[opts.docType] || DOC_TYPE_COLORS.quote;
  const companyDisplay = truncate(opts.companyName, 36);
  const customerDisplay = opts.customerName ? truncate(opts.customerName, 34) : "";
  const docNoDisplay = truncate(opts.docNo, 28);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="630" fill="${escXml(colors.bg)}" opacity="0.35"/>

  <rect x="0" y="0" width="1200" height="10" fill="${escXml(colors.accent)}"/>

  <rect x="60" y="55" width="80" height="80" rx="16" fill="${escXml(colors.accent)}"/>
  <text x="100" y="108" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#ffffff" font-weight="700" text-anchor="middle">${escXml(colors.icon)}</text>

  <text x="160" y="88" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#9ca3af" font-weight="400">E-Tax Center</text>
  <text x="160" y="122" font-family="Arial,Helvetica,sans-serif" font-size="36" fill="${escXml(colors.accent)}" font-weight="700">${escXml(opts.docLabel)}</text>

  <line x1="60" y1="160" x2="1140" y2="160" stroke="${escXml(colors.accent)}" stroke-width="2" opacity="0.2"/>

  <text x="80" y="220" font-family="Arial,Helvetica,sans-serif" font-size="52" fill="#111827" font-weight="700">${escXml(docNoDisplay)}</text>

  <rect x="80" y="260" width="500" height="1" fill="#e5e7eb"/>

  <text x="80" y="310" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#9ca3af" font-weight="400">FROM</text>
  <text x="80" y="348" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="#374151" font-weight="600">${escXml(companyDisplay)}</text>

  ${customerDisplay ? `
  <text x="80" y="410" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#9ca3af" font-weight="400">TO</text>
  <text x="80" y="448" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="#374151" font-weight="600">${escXml(customerDisplay)}</text>` : ""}

  ${opts.amount ? `
  <rect x="700" y="260" width="440" height="140" rx="20" fill="${escXml(colors.accent)}" opacity="0.08"/>
  <rect x="700" y="260" width="440" height="140" rx="20" fill="none" stroke="${escXml(colors.accent)}" stroke-width="2" opacity="0.3"/>
  <text x="920" y="310" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="${escXml(colors.accent)}" font-weight="500" text-anchor="middle">${escXml(opts.amountLabel)}</text>
  <text x="920" y="370" font-family="Arial,Helvetica,sans-serif" font-size="48" fill="${escXml(colors.accent)}" font-weight="700" text-anchor="middle">B${escXml(opts.amount)}</text>` : ""}

  <rect x="0" y="570" width="1200" height="60" fill="${escXml(colors.accent)}" opacity="0.08"/>
  <text x="600" y="608" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#9ca3af" text-anchor="middle">Digital Accounting Platform</text>
</svg>`;
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function sendOgHtml(res: Response, opts: { title: string; desc: string; image: string; url: string }) {
  res.status(200).set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  }).end(
`<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(opts.title)}</title>
<meta property="og:title" content="${escHtml(opts.title)}" />
<meta property="og:description" content="${escHtml(opts.desc)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escHtml(opts.image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${escHtml(opts.url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escHtml(opts.title)}" />
<meta name="twitter:description" content="${escHtml(opts.desc)}" />
<meta name="twitter:image" content="${escHtml(opts.image)}" />
</head><body><script>window.location.href="${escHtml(opts.url)}";</script></body></html>`);
}

const DOC_TYPE_LABELS: Record<string, string> = {
  quote: "QUOTATION",
  invoice: "INVOICE",
  "tax-invoice": "TAX INVOICE",
  receipt: "RECEIPT",
  order: "SALES ORDER",
  contract: "SERVICE CONTRACT",
};

const DOC_TYPE_LABELS_TH: Record<string, string> = {
  quote: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  "tax-invoice": "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
  order: "ใบสั่งขาย",
  contract: "สัญญาบริการ",
};

async function lookupDoc(docType: string, token: string) {
  let docNo = "";
  let customerName = "";
  let total = "";
  let companyId = 0;
  let amountLabel = "TOTAL";

  switch (docType) {
    case "quote": {
      const [qo] = await db.select().from(quotations).where(eq(quotations.shareToken, token));
      if (qo) { docNo = qo.quotationNo || ""; customerName = (qo as any).customerName || ""; total = (qo as any).grandTotal; companyId = qo.companyId; }
      break;
    }
    case "invoice": {
      const [iv] = await db.select().from(invoices).where(eq(invoices.shareToken, token));
      if (iv) { docNo = iv.invoiceNo || ""; customerName = (iv as any).customerName || ""; total = (iv as any).grandTotal || (iv as any).totalAmount; companyId = iv.companyId; }
      break;
    }
    case "tax-invoice": {
      const [tiv] = await db.select().from(taxInvoices).where(eq(taxInvoices.shareToken, token));
      if (tiv) { docNo = tiv.taxInvoiceNo || ""; customerName = (tiv as any).customerName || ""; total = (tiv as any).grandTotal || (tiv as any).totalAmount; companyId = tiv.companyId; }
      break;
    }
    case "receipt": {
      const [re] = await db.select().from(receipts).where(eq(receipts.shareToken, token));
      if (re) { docNo = re.receiptNo || ""; customerName = (re as any).customerName || ""; total = (re as any).grandTotal || (re as any).totalAmount; companyId = re.companyId; }
      break;
    }
    case "order": {
      const [so] = await db.select().from(salesOrders).where(eq(salesOrders.shareToken, token));
      if (so) { docNo = so.orderNo || ""; customerName = (so as any).customerName || ""; total = (so as any).grandTotal || (so as any).totalAmount; companyId = so.companyId; }
      break;
    }
    case "contract": {
      const [ct] = await db.select().from(contracts).where(eq(contracts.publicToken, token));
      if (ct) { docNo = ct.contractNo || ""; customerName = ct.clientName || ""; total = ct.serviceFee ? String(ct.serviceFee) : ""; companyId = ct.companyId; amountLabel = "FEE/MONTH"; }
      break;
    }
  }

  let companyName = "E-Tax Center";
  if (companyId) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company) companyName = company.name;
  }

  const fmtTotal = total ? Number(total).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "";

  return { docNo, customerName, companyName, fmtTotal, companyId, amountLabel };
}

export function registerOgImageRoute(app: any) {
  app.get("/api/og-image/:docType/:token.png", async (req: Request, res: Response) => {
    const { docType, token } = req.params;
    const label = DOC_TYPE_LABELS[docType] || "DOCUMENT";

    try {
      const info = await lookupDoc(docType, token);

      const svg = generateOgSvg({
        docLabel: label,
        docNo: info.docNo,
        companyName: info.companyName,
        customerName: info.customerName,
        amount: info.fmtTotal,
        amountLabel: info.amountLabel,
        docType,
      });

      const png = await svgToPng(svg);
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" }).end(png);
    } catch (err) {
      const svg = generateOgSvg({
        docLabel: label,
        docNo: "",
        companyName: "E-Tax Center",
        customerName: "",
        amount: "",
        amountLabel: "TOTAL",
        docType,
      });
      try {
        const png = await svgToPng(svg);
        res.set({ "Content-Type": "image/png" }).end(png);
      } catch {
        res.status(500).end();
      }
    }
  });
}

export async function shareOgHandler(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] || "";
  if (!BOT_RE.test(ua)) return next();

  const host = req.get("host") || "";
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const baseUrl = `${proto}://${host}`;
  const fullUrl = baseUrl + req.originalUrl;
  const docType = req.params.docType || "quote";
  const token = req.params.token;
  const labelTh = DOC_TYPE_LABELS_TH[docType] || "เอกสาร";
  const ogImage = `${baseUrl}/api/og-image/${docType}/${token}.png`;

  try {
    const info = await lookupDoc(docType, token);

    if (!info.docNo) {
      return sendOgHtml(res, { title: `${labelTh} - E-Tax Center`, desc: `ดูรายละเอียด${labelTh}ออนไลน์`, image: ogImage, url: fullUrl });
    }

    const title = `${labelTh} ${info.docNo} - ${info.companyName}`;
    const desc = `${info.companyName}${info.customerName ? ` → ${info.customerName}` : ""}${info.fmtTotal ? ` | ยอดรวม ฿${info.fmtTotal}` : ""}`;

    sendOgHtml(res, { title, desc, image: ogImage, url: fullUrl });
  } catch {
    sendOgHtml(res, { title: `${labelTh} - E-Tax Center`, desc: `ดูรายละเอียด${labelTh}ออนไลน์`, image: ogImage, url: fullUrl });
  }
}

export async function contractOgHandler(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] || "";
  if (!BOT_RE.test(ua)) return next();

  const host = req.get("host") || "";
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const baseUrl = `${proto}://${host}`;
  const fullUrl = baseUrl + req.originalUrl;
  const token = req.params.token;
  const ogImage = `${baseUrl}/api/og-image/contract/${token}.png`;

  try {
    const info = await lookupDoc("contract", token);

    if (!info.docNo) {
      return sendOgHtml(res, { title: "สัญญาบริการ - E-Tax Center", desc: "ลงนามสัญญาบริการออนไลน์", image: ogImage, url: fullUrl });
    }

    const title = `สัญญาบริการ ${info.docNo} - ${info.companyName}`;
    const desc = `${info.companyName}${info.customerName ? ` → ${info.customerName}` : ""}${info.fmtTotal ? ` | ค่าบริการ ฿${info.fmtTotal}/เดือน` : ""}`;

    sendOgHtml(res, { title, desc, image: ogImage, url: fullUrl });
  } catch {
    sendOgHtml(res, { title: "สัญญาบริการ - E-Tax Center", desc: "ลงนามสัญญาบริการออนไลน์", image: ogImage, url: fullUrl });
  }
}
