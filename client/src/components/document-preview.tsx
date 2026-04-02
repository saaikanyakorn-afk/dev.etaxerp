import { objectPathToUrl } from "@/lib/utils";
import {
  DOCUMENT_TYPES_FULL,
  getDocumentType,
  getDocTypeColor,
  parseCategoryColors,
  formatDocNumber,
  formatThaiDate,
  type DocNumberFormat,
  type DateEra,
} from "@shared/document-types";

interface DocSettings {
  logoUrl?: string | null;
  showLogo: boolean;
  showSignature: boolean;
  showTaxId: boolean;
  showBranch: boolean;
  headerNote?: string | null;
  footerNote?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  qrCodeUrl?: string | null;
  docFontSize?: string;
  showQrOnDoc?: boolean;
  docTypeColors?: string | null;
  colorMode?: string | null;
  docNumberFormat?: string | null;
  docNumberDigits?: number | null;
  dateEra?: string | null;
}

interface Company {
  name?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  branch?: string;
}

interface UserSignature {
  signatureUrl?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
}

interface DocumentPreviewProps {
  settings: DocSettings;
  company?: Company | null;
  userSignature?: UserSignature | null;
  documentType?: string;
  referenceDoc?: { type: string; number: string } | null;
}

interface LineItem {
  desc: string;
  qty: number;
  price: number;
  discount: number;
  amount: number;
}

const MOCK_ITEMS_BY_TYPE: Record<string, LineItem[]> = {
  quotation: [
    { desc: "ค่าบริการทำบัญชี รายเดือน", qty: 12, price: 5000, discount: 0, amount: 60000 },
    { desc: "ค่าบริการยื่นภาษี", qty: 12, price: 1500, discount: 0, amount: 18000 },
  ],
  invoice: [
    { desc: "ค่าบริการทำบัญชี เดือน ม.ค. 2569", qty: 1, price: 5000, discount: 0, amount: 5000 },
    { desc: "ค่าบริการยื่นภาษี ภ.พ.30", qty: 1, price: 1500, discount: 0, amount: 1500 },
    { desc: "ค่าบริการยื่นประกันสังคม", qty: 1, price: 800, discount: 0, amount: 800 },
  ],
  tax_invoice: [
    { desc: "ค่าบริการทางด้านบัญชี ต.12/68", qty: 1, price: 4500, discount: 0, amount: 4500 },
  ],
  purchase_order: [
    { desc: "กระดาษ A4 (5 รีม)", qty: 5, price: 180, discount: 0, amount: 900 },
    { desc: "หมึกพิมพ์ HP 680 สีดำ", qty: 2, price: 450, discount: 0, amount: 900 },
  ],
  receipt: [
    { desc: "ค่าบริการทำบัญชี เดือน ม.ค. 2569", qty: 1, price: 5000, discount: 0, amount: 5000 },
    { desc: "ค่าบริการยื่นภาษี ภ.พ.30", qty: 1, price: 1500, discount: 0, amount: 1500 },
  ],
};

const DEFAULT_ITEMS: LineItem[] = [
  { desc: "รายการตัวอย่าง 1", qty: 1, price: 3000, discount: 0, amount: 3000 },
  { desc: "รายการตัวอย่าง 2", qty: 2, price: 1500, discount: 0, amount: 3000 },
];

function numberToThaiText(num: number): string {
  if (num === 0) return "ศูนย์บาทถ้วน";
  if (num < 0) return "ลบ" + numberToThaiText(Math.abs(num));

  const thaiDigits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const placeNames = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

  const absNum = Math.abs(num);
  const intPart = Math.floor(absNum);
  const decStr = absNum.toFixed(2).split(".")[1];
  const decPart = parseInt(decStr, 10);

  function convertChunk(n: number): string {
    if (n === 0) return "";
    const s = n.toString();
    let out = "";
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(s[i]);
      const place = len - i - 1;
      if (digit === 0) continue;
      if (place === 1 && digit === 1) {
        out += "สิบ";
      } else if (place === 1 && digit === 2) {
        out += "ยี่สิบ";
      } else if (place === 0 && digit === 1 && len > 1) {
        out += "เอ็ด";
      } else {
        out += thaiDigits[digit] + (placeNames[place] || "");
      }
    }
    return out;
  }

  function convertFull(n: number): string {
    if (n === 0) return "";
    if (n < 1000000) return convertChunk(n);
    const mil = Math.floor(n / 1000000);
    const rem = n % 1000000;
    let result = convertFull(mil) + "ล้าน";
    if (rem > 0) result += convertChunk(rem);
    return result;
  }

  let result = "";
  if (intPart > 0) {
    result += convertFull(intPart) + "บาท";
  } else {
    result += "ศูนย์บาท";
  }
  if (decPart > 0) {
    result += convertChunk(decPart) + "สตางค์";
  } else {
    result += "ถ้วน";
  }
  return result;
}

export default function DocumentPreview({
  settings,
  company,
  userSignature,
  documentType = "tax_invoice",
  referenceDoc,
}: DocumentPreviewProps) {
  const docInfo = getDocumentType(documentType) || DOCUMENT_TYPES_FULL[4];
  const categoryColors = parseCategoryColors(settings.docTypeColors);
  const theme = getDocTypeColor(documentType, categoryColors, settings.colorMode || "color");
  const primary = theme.primary;
  const accent = theme.accent;

  const companyName = company?.name || "บริษัท ตัวอย่าง จำกัด";
  const taxId = company?.taxId || "0123456789012";
  const address = company?.address || "123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กทม. 10110";
  const phone = company?.phone || "02-123-4567";
  const branch = company?.branch || "สำนักงานใหญ่";

  const items = MOCK_ITEMS_BY_TYPE[documentType] || DEFAULT_ITEMS;
  const computedItems = items.map(item => ({
    ...item,
    amount: (item.qty * item.price) - item.discount,
  }));
  const subtotal = computedItems.reduce((sum, i) => sum + i.amount, 0);
  const specialDiscount = 0;
  const valueBeforeVat = subtotal - specialDiscount;
  const hasVat = docInfo.hasVat;
  const vat = hasVat ? Math.round(valueBeforeVat * 0.07) : 0;
  const withholdingTax = hasVat ? Math.round(valueBeforeVat * 0.03) : 0;
  const grandTotal = valueBeforeVat + vat - withholdingTax;

  const formatNumber = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const era = (settings.dateEra as DateEra) || "CE";
  const numFormat = (settings.docNumberFormat as DocNumberFormat) || "Y_SEQ";
  const digits = settings.docNumberDigits || 5;
  const docNumber = formatDocNumber(docInfo.prefix, 1, numFormat, digits, era);
  const displayDate = formatThaiDate(undefined, era);

  const isBranchHQ = !branch || branch === "สำนักงานใหญ่" || branch === "00000";
  const branchDisplay = isBranchHQ ? "สำนักงานใหญ่" : `สาขาที่ ${branch}`;

  const minRows = 5;
  const emptyRows = Math.max(0, minRows - computedItems.length);

  const showPaymentCheckboxes = ["receipt", "tax_invoice_receipt", "tax_invoice", "payment_voucher", "receipt_voucher", "deposit"].includes(documentType);
  const showInvoicePaymentTerms = documentType === "invoice";
  const showBankInfo = ["receipt", "tax_invoice_receipt", "tax_invoice", "deposit"].includes(documentType);

  const getSignatureLabels = (): { left: string; leftSub: string; right: string; rightSub: string } => {
    switch (documentType) {
      case "quotation":
        return { left: "ผู้อนุมัติ / ลูกค้า", leftSub: "Approved by", right: "ผู้เสนอราคา", rightSub: "Salesperson" };
      case "sales_order":
        return { left: "ผู้สั่งซื้อ", leftSub: "Ordered by", right: "ผู้รับคำสั่ง", rightSub: "Accepted by" };
      case "delivery_note":
        return { left: "ผู้รับของ", leftSub: "Received by", right: "ผู้ส่งของ", rightSub: "Delivered by" };
      case "invoice":
        return { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" };
      case "tax_invoice":
        return { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้มีอำนาจลงนาม", rightSub: "Authorized" };
      case "receipt":
        return { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" };
      case "tax_invoice_receipt":
        return { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" };
      case "credit_note":
      case "debit_note":
        return { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" };
      case "purchase_request":
        return { left: "ผู้ขอซื้อ", leftSub: "Requested by", right: "ผู้อนุมัติ", rightSub: "Approved by" };
      case "purchase_order":
        return { left: "ผู้สั่งซื้อ", leftSub: "Ordered by", right: "ผู้อนุมัติ", rightSub: "Approved by" };
      case "payment_voucher":
        return { left: "ผู้รับเงิน", leftSub: "Received by", right: "ผู้จ่ายเงิน", rightSub: "Paid by" };
      case "receipt_voucher":
        return { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" };
      case "deposit":
        return { left: "ผู้ชำระเงิน", leftSub: "Deposited by", right: "ผู้รับเงินมัดจำ", rightSub: "Received by" };
      default:
        return { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" };
    }
  };

  const getFooterNote = (): string | null => {
    if (settings.footerNote) return settings.footerNote;
    switch (documentType) {
      case "quotation":
        return "ใบเสนอราคานี้มีอายุ 30 วัน นับจากวันที่ออกเอกสาร";
      case "receipt":
      case "tax_invoice_receipt":
        return null;
      default:
        return null;
    }
  };

  const getPaymentDisclaimer = (): string | null => {
    switch (documentType) {
      case "receipt":
      case "tax_invoice_receipt":
      case "deposit":
        return "ใบเสร็จรับเงินจะสมบูรณ์เมื่อผู้รับเงินได้ลงนามรับเงินแล้ว, หากจ่ายด้วยเช็คหรือบัตรเครดิต\nใบเสร็จรับเงินจะสมบูรณ์เมื่อเรียกเก็บเงินได้แล้ว";
      case "payment_voucher":
      case "receipt_voucher":
        return "เอกสารนี้จะสมบูรณ์เมื่อมีการลงนามครบถ้วน";
      default:
        return null;
    }
  };

  const sigLabels = getSignatureLabels();
  const footerNoteText = getFooterNote();
  const paymentDisclaimer = getPaymentDisclaimer();

  const renderSummaryColumn = () => (
    <div className="w-52">
      <div className="flex justify-between text-[10px] py-1 border-b border-gray-100">
        <div>
          <div>ยอดรวม</div>
          <div className="text-[8px] text-gray-400">Sub Total</div>
        </div>
        <span className="self-center">{formatNumber(subtotal)}</span>
      </div>
      <div className="flex justify-between text-[10px] py-1 border-b border-gray-100">
        <div>
          <div>ส่วนลดพิเศษ</div>
          <div className="text-[8px] text-gray-400">Special Discount</div>
        </div>
        <span className="self-center">{formatNumber(specialDiscount)}</span>
      </div>
      <div className="flex justify-between text-[10px] py-1 border-b border-gray-100">
        <div>
          <div>มูลค่าก่อนภาษี</div>
          <div className="text-[8px] text-gray-400">Value Before VAT</div>
        </div>
        <span className="self-center">{formatNumber(valueBeforeVat)}</span>
      </div>
      <div className="flex justify-between text-[10px] py-1 border-b border-gray-100">
        <div>
          <div>ภาษีมูลค่าเพิ่ม 7%</div>
          <div className="text-[8px] text-gray-400">Value Added Tax</div>
        </div>
        <span className="self-center">{formatNumber(vat)}</span>
      </div>
      <div className="flex justify-between text-[10px] py-1 border-b border-gray-100">
        <div>
          <div>ภาษีหัก ณ ที่จ่าย</div>
          <div className="text-[8px] text-gray-400">Withholding Tax</div>
        </div>
        <span className="self-center">{formatNumber(withholdingTax)}</span>
      </div>
      <div
        className="flex justify-between text-xs font-bold py-2 mt-1 rounded px-2"
        style={{ backgroundColor: primary, color: "white" }}
      >
        <div>
          <div>ยอดเงินสุทธิ</div>
          <div className="text-[8px] font-normal opacity-80">Grand Total</div>
        </div>
        <span className="self-center">{formatNumber(grandTotal)}</span>
      </div>
    </div>
  );

  const renderPaymentSection = () => (
    <div className="border rounded p-2.5 text-[10px] text-gray-700" style={{ borderColor: theme.light }}>
      <div className="font-medium mb-1.5">ชำระเงินโดย :</div>
      <div className="flex gap-6 mb-1">
        <label className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 border border-gray-400 rounded-sm inline-block flex-shrink-0" /> เงินสด
        </label>
        <label className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 border border-gray-400 rounded-sm inline-block flex-shrink-0" /> เงินโอน
        </label>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-3.5 h-3.5 border border-gray-400 rounded-sm inline-block flex-shrink-0" />
        <span>เช็คธนาคาร / เลขที่ / ลงวันที่ / มูลค่าก่อนภาษี</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-3.5 h-3.5 border border-gray-400 rounded-sm inline-block flex-shrink-0" />
        <span>อื่นๆ _______________</span>
      </div>
      {paymentDisclaimer && (
        <div className="border-t pt-1.5 text-[9px] text-gray-400 leading-tight whitespace-pre-line" style={{ borderColor: theme.light }}>
          {paymentDisclaimer}
        </div>
      )}
    </div>
  );

  const renderSignatureSection = () => {
    if (!settings.showSignature) return null;
    return (
      <div className="flex justify-between mt-4 pt-4">
        <div className="text-center w-40">
          <div className="h-10 mb-1" />
          <div className="border-t border-gray-400 pt-1">
            <div className="text-[10px] font-medium">{sigLabels.left}</div>
            <div className="text-[9px] text-gray-500">{sigLabels.leftSub}</div>
            <div className="text-[9px] text-gray-500">วันที่ ____/____/____</div>
          </div>
        </div>
        <div className="text-center w-40">
          {userSignature?.signatureUrl ? (
            <img src={objectPathToUrl(userSignature.signatureUrl)} alt="Signature" className="h-10 mx-auto mb-1 object-contain" />
          ) : (
            <div className="h-10 mb-1" />
          )}
          <div className="border-t border-gray-400 pt-1">
            <div className="text-[10px] font-medium">
              {userSignature?.signatureName || sigLabels.right}
            </div>
            <div className="text-[9px] text-gray-500">{sigLabels.rightSub}</div>
            {userSignature?.signatureTitle && (
              <div className="text-[9px] text-gray-500">{userSignature.signatureTitle}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInvoicePaymentTerms = () => (
    <div className="border rounded p-2.5 text-[10px] text-gray-700" style={{ borderColor: theme.light }}>
      <div className="space-y-1">
        <div className="flex items-start gap-1.5">
          <span className="flex-shrink-0 mt-0.5">■</span>
          <span>
            เงื่อนไขการชำระเงิน: โอนเงินเข้าบัญชี {settings.bankName || "ธนาคารกสิกรไทย"} ชื่อ {settings.bankAccountName || "บจก. ตัวอย่าง"} เลขบัญชี {settings.bankAccountNumber || "000-0-00000-0"}
          </span>
        </div>
        {referenceDoc && (
          <div className="flex items-start gap-1.5">
            <span className="flex-shrink-0 mt-0.5">■</span>
            <span>เลขที่ใบสั่งขาย: {referenceDoc.number}</span>
          </div>
        )}
      </div>
      <div className="border-t mt-2 pt-1.5 text-[9px] text-gray-500 leading-tight" style={{ borderColor: theme.light }}>
        โอนเงินเข้าบัญชี {settings.bankName || "ธนาคารกสิกรไทย"} ชื่อ {settings.bankAccountName || "บจก. ตัวอย่าง"} เลขบัญชี {settings.bankAccountNumber || "000-0-00000-0"}
      </div>
    </div>
  );

  const renderFooterByDocType = () => (
    <>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="border rounded p-2.5 mb-3" style={{ borderColor: theme.light, backgroundColor: theme.bg }}>
            <div className="text-[10px] font-semibold text-center text-gray-700">
              {numberToThaiText(grandTotal)}
            </div>
          </div>
          {showPaymentCheckboxes && renderPaymentSection()}
          {showInvoicePaymentTerms && renderInvoicePaymentTerms()}
          {!showPaymentCheckboxes && !showInvoicePaymentTerms && footerNoteText && (
            <div className="text-[10px] text-gray-500 mt-2 whitespace-pre-line">{footerNoteText}</div>
          )}
        </div>
        {renderSummaryColumn()}
      </div>

      {showBankInfo && (settings.bankName || settings.qrCodeUrl) && (
        <div className="flex items-start gap-3 mb-4 border-t pt-3">
          {(settings.showQrOnDoc ?? true) && (
            settings.qrCodeUrl ? (
              <div className="w-16 h-16 border rounded overflow-hidden flex items-center justify-center bg-gray-50">
                <img src={objectPathToUrl(settings.qrCodeUrl)} alt="QR Code" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center bg-gray-50">
                <span className="text-[8px] text-muted-foreground text-center leading-tight">QR<br />Code</span>
              </div>
            )
          )}
          <div className="text-[10px] text-gray-600">
            <div className="font-medium text-gray-700 mb-0.5">ข้อมูลชำระเงิน</div>
            {settings.bankName && <div>ธนาคาร: {settings.bankName}</div>}
            {settings.bankAccountNumber && <div>เลขที่บัญชี: {settings.bankAccountNumber}</div>}
            {settings.bankAccountName && <div>ชื่อบัญชี: {settings.bankAccountName}</div>}
          </div>
        </div>
      )}

      {(showPaymentCheckboxes || showInvoicePaymentTerms) && footerNoteText && (
        <div className="border-t pt-2 mb-4">
          <div className="text-[10px] text-gray-500 whitespace-pre-line">{footerNoteText}</div>
        </div>
      )}

      {renderSignatureSection()}
    </>
  );

  return (
    <div
      className="doc-preview-paper bg-white dark:bg-white border dark:border-gray-300 rounded-lg shadow-sm overflow-hidden"
      style={{ fontSize: ({ small: "10px", medium: "12px", large: "14px", xlarge: "16px" } as Record<string,string>)[settings.docFontSize || "medium"] || "12px", lineHeight: 1.5, colorScheme: "light" }}
      data-testid="document-preview"
    >
      <div className="h-1.5" style={{ background: primary }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            {settings.showLogo && (
              <div className="w-16 h-16 rounded border bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {settings.logoUrl ? (
                  <img src={objectPathToUrl(settings.logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[9px] text-muted-foreground text-center leading-tight">โลโก้<br />บริษัท</span>
                )}
              </div>
            )}
            <div className="text-left">
              <div className="font-bold text-sm" style={{ color: primary }}>{companyName}</div>
              <div className="text-[10px] text-gray-600 mt-0.5 max-w-[220px]">{address}</div>
              <div className="text-[10px] text-gray-600">โทร. {phone}</div>
              {settings.showTaxId && (
                <div className="text-[10px] text-gray-600">
                  เลขประจำตัวผู้เสียภาษี: {taxId}
                </div>
              )}
              {settings.showBranch && (
                <div className="text-[10px] font-medium" style={{ color: primary }}>
                  {branchDisplay}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-bold text-base px-3 py-1 rounded-md inline-block"
              style={{ color: primary, backgroundColor: theme.bg }}
            >
              {docInfo.label}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{docInfo.labelEn.toUpperCase()}</div>
            <div className="mt-2 text-[10px]">
              <div>เลขที่: <span className="font-semibold" style={{ color: accent }}>{docNumber}</span></div>
              <div>วันที่: {displayDate}</div>
              {referenceDoc && (
                <div className="mt-1 text-[9px]" style={{ color: primary }}>
                  อ้างอิง: {referenceDoc.type} {referenceDoc.number}
                </div>
              )}
            </div>
          </div>
        </div>

        {settings.headerNote && (
          <div className="text-[10px] text-gray-500 mb-3 italic">{settings.headerNote}</div>
        )}

        <div className="border rounded p-2.5 mb-4 text-left" style={{ borderColor: theme.light, backgroundColor: theme.bg }}>
          <div className="text-[10px] font-medium mb-1" style={{ color: primary }}>ลูกค้า / Customer</div>
          <div className="font-medium text-xs text-gray-800">บริษัท ลูกค้าตัวอย่าง จำกัด</div>
          <div className="text-[10px] text-gray-600">789/10 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กทม. 10310</div>
          <div className="text-[10px] text-gray-600">เลขประจำตัวผู้เสียภาษี: 0987654321001</div>
          <div className="text-[10px] font-medium" style={{ color: primary }}>สำนักงานใหญ่</div>
        </div>

        <table className="w-full border-collapse mb-4">
          <thead>
            <tr style={{ backgroundColor: theme.light + "40" }}>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold border-b w-8" style={{ color: accent, borderColor: theme.light }}>
                <div>ลำดับ</div>
                <div className="text-[8px] font-normal opacity-70">No.</div>
              </th>
              <th className="text-left py-1.5 px-2 text-[10px] font-semibold border-b" style={{ color: accent, borderColor: theme.light }}>
                <div>รายละเอียด</div>
                <div className="text-[8px] font-normal opacity-70">Description</div>
              </th>
              <th className="text-center py-1.5 px-2 text-[10px] font-semibold border-b w-12" style={{ color: accent, borderColor: theme.light }}>
                <div>จำนวน</div>
                <div className="text-[8px] font-normal opacity-70">Quantity</div>
              </th>
              <th className="text-right py-1.5 px-2 text-[10px] font-semibold border-b w-20" style={{ color: accent, borderColor: theme.light }}>
                <div>ราคาต่อหน่วย</div>
                <div className="text-[8px] font-normal opacity-70">Unit Price</div>
              </th>
              <th className="text-right py-1.5 px-2 text-[10px] font-semibold border-b w-16" style={{ color: accent, borderColor: theme.light }}>
                <div>ส่วนลด</div>
                <div className="text-[8px] font-normal opacity-70">Discount</div>
              </th>
              <th className="text-right py-1.5 px-2 text-[10px] font-semibold border-b w-20" style={{ color: accent, borderColor: theme.light }}>
                <div>มูลค่า</div>
                <div className="text-[8px] font-normal opacity-70">Value</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {computedItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 px-1 text-[10px] text-center text-gray-500">{i + 1}</td>
                <td className="py-1.5 px-2 text-[10px]">{item.desc}</td>
                <td className="py-1.5 px-2 text-[10px] text-center">{item.qty}</td>
                <td className="py-1.5 px-2 text-[10px] text-right">{formatNumber(item.price)}</td>
                <td className="py-1.5 px-2 text-[10px] text-right">{formatNumber(item.discount)}</td>
                <td className="py-1.5 px-2 text-[10px] text-right">{formatNumber(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-gray-100">
                <td className="py-1.5 px-1 text-[10px]">&nbsp;</td>
                <td className="py-1.5 px-2 text-[10px]">&nbsp;</td>
                <td className="py-1.5 px-2 text-[10px]">&nbsp;</td>
                <td className="py-1.5 px-2 text-[10px]">&nbsp;</td>
                <td className="py-1.5 px-2 text-[10px]">&nbsp;</td>
                <td className="py-1.5 px-2 text-[10px]">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {renderFooterByDocType()}

        <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: primary, fontSize: "7px" }}
            >
              ET
            </div>
            <span className="text-[8px] text-gray-400 tracking-wide">
              Powered by <span className="font-semibold" style={{ color: primary }}>E-Tax Center</span>
            </span>
          </div>
          <span className="text-[8px] text-gray-300">{docNumber}</span>
        </div>
      </div>
    </div>
  );
}
