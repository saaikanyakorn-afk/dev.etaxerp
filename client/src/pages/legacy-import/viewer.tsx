import { useState, useCallback, useRef, useMemo } from "react";
import LegacyLayout from "@/components/legacy-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  FileSpreadsheet,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderArchive,
  X,
  ArrowLeft,
  BookOpen,
  ShoppingCart,
  CreditCard,
  Wallet,
  Package,
  Building2,
  Users,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Settings,
  Landmark,
  MapPin,
  Hash,
  Calendar,
  FileText,
  Eye,
} from "lucide-react";

interface ZipTable {
  name: string;
  rowCount: number;
  columns: string[];
}

interface ZipInfo {
  companyId: string;
  companyName: string;
  tables: ZipTable[];
  totalRows: number;
}

interface TableData {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
  page: number;
  totalPages: number;
}

interface MenuItem {
  key: string;
  label: string;
  icon: any;
  children: { key: string; label: string; tableName: string; itemTable?: string }[];
}

const MENU_STRUCTURE: MenuItem[] = [
  {
    key: "accounting",
    label: "การบัญชี",
    icon: BookOpen,
    children: [
      { key: "gl", label: "สมุดรายวัน (GL)", tableName: "gl" },
      { key: "gl_tran", label: "รายการบัญชี", tableName: "gl_tran" },
      { key: "gl_report", label: "รายงาน GL", tableName: "gl_report" },
      { key: "chart_of_account", label: "ผังบัญชี", tableName: "chart_of_account" },
      { key: "mbook", label: "สมุดบัญชี", tableName: "mbook" },
    ],
  },
  {
    key: "sales",
    label: "การขาย & รายได้",
    icon: ShoppingCart,
    children: [
      { key: "quotation", label: "ใบเสนอราคา [QO]", tableName: "quotation", itemTable: "quotation_item" },
      { key: "bill", label: "ใบแจ้งหนี้ / ใบกำกับภาษี", tableName: "bill", itemTable: "bill_item" },
      { key: "bn", label: "ใบวางบิล", tableName: "bn", itemTable: "bn_item" },
      { key: "receipt", label: "ใบเสร็จรับเงิน", tableName: "receipt", itemTable: "receipt_item" },
    ],
  },
  {
    key: "purchase",
    label: "การซื้อ & รายจ่าย",
    icon: CreditCard,
    children: [
      { key: "po", label: "ใบสั่งซื้อ", tableName: "po", itemTable: "po_item" },
      { key: "expense", label: "ค่าใช้จ่าย", tableName: "expense", itemTable: "expense_item" },
      { key: "payment", label: "ใบสำคัญจ่าย", tableName: "payment", itemTable: "payment_item" },
    ],
  },
  {
    key: "finance",
    label: "การเงิน",
    icon: Wallet,
    children: [
      { key: "wht", label: "หนังสือรับรองหัก ณ ที่จ่าย", tableName: "wht", itemTable: "wht_item" },
      { key: "wht_contact", label: "ผู้ถูกหักภาษี", tableName: "wht_contact" },
    ],
  },
  {
    key: "contacts",
    label: "ประวัติคู่ค้า",
    icon: Users,
    children: [
      { key: "contact", label: "รายชื่อคู่ค้า", tableName: "contact" },
      { key: "contact_etax", label: "ข้อมูล e-Tax คู่ค้า", tableName: "contact_etax" },
    ],
  },
  {
    key: "inventory",
    label: "คลังสินค้า",
    icon: Package,
    children: [
      { key: "inventory", label: "รายการสินค้า", tableName: "inventory" },
      { key: "inventory_balance", label: "ยอดสต๊อก", tableName: "inventory_balance" },
      { key: "pack", label: "หน่วยนับ", tableName: "pack" },
    ],
  },
  {
    key: "assets",
    label: "ทะเบียนสินทรัพย์",
    icon: Building2,
    children: [
      { key: "asset", label: "รายการสินทรัพย์", tableName: "asset" },
    ],
  },
  {
    key: "hr",
    label: "บุคลากร / เงินเดือน",
    icon: Users,
    children: [
      { key: "hr_payroll", label: "Payroll", tableName: "hr_payroll", itemTable: "hr_payroll_item" },
      { key: "hr_applicant", label: "พนักงาน", tableName: "hr_applicant" },
      { key: "hr_setting", label: "ตั้งค่า HR", tableName: "hr_setting" },
      { key: "drhr_salary", label: "เงินเดือน", tableName: "drhr_salary" },
      { key: "drhr_attendance", label: "เวลาเข้างาน", tableName: "drhr_attendance" },
      { key: "drhr_leave", label: "การลา", tableName: "drhr_leave" },
      { key: "drhr_ot", label: "ล่วงเวลา", tableName: "drhr_ot" },
    ],
  },
  {
    key: "settings",
    label: "ตั้งค่า / อื่นๆ",
    icon: Settings,
    children: [
      { key: "company_setting", label: "ข้อมูลบริษัท", tableName: "company_setting" },
      { key: "etax", label: "ตั้งค่า e-Tax", tableName: "etax" },
      { key: "category", label: "หมวดหมู่", tableName: "category" },
      { key: "gl_purchase_report", label: "รายงานซื้อ (GL)", tableName: "gl_purchase_report" },
    ],
  },
];

interface DocTableConfig {
  label: string;
  docNoField: string;
  dateField: string;
  contactField: string;
  totalField: string;
  prefix: string;
}

const DOC_TABLES: Record<string, DocTableConfig> = {
  bill: { label: "ใบแจ้งหนี้/ใบกำกับภาษี", docNoField: "bill_no", dateField: "bill_date", contactField: "contact_name", totalField: "grand_total", prefix: "IV" },
  quotation: { label: "ใบเสนอราคา", docNoField: "quotation_no", dateField: "quotation_date", contactField: "contact_name", totalField: "grand_total", prefix: "QO" },
  receipt: { label: "ใบเสร็จรับเงิน", docNoField: "receipt_no", dateField: "receipt_date", contactField: "contact_name", totalField: "grand_total", prefix: "RC" },
  payment: { label: "ใบสำคัญจ่าย", docNoField: "payment_no", dateField: "payment_date", contactField: "contact_name", totalField: "grand_total", prefix: "PV" },
  expense: { label: "ค่าใช้จ่าย", docNoField: "expense_no", dateField: "expense_date", contactField: "description", totalField: "grand_total", prefix: "EX" },
  po: { label: "ใบสั่งซื้อ", docNoField: "po_no", dateField: "po_date", contactField: "contact_name", totalField: "grand_total", prefix: "PO" },
  bn: { label: "ใบวางบิล", docNoField: "bn_no", dateField: "bn_date", contactField: "contact_name", totalField: "grand_total", prefix: "BN" },
  wht: { label: "หนังสือรับรองหัก ณ ที่จ่าย", docNoField: "wht_no", dateField: "wht_date", contactField: "contact_name", totalField: "total", prefix: "WT" },
  hr_payroll: { label: "Payroll", docNoField: "payroll_no", dateField: "payroll_date", contactField: "employee_name", totalField: "net_pay", prefix: "PR" },
};

interface TableDisplayConfig {
  titleFields: string[];
  subtitleFields: string[];
  dateFields: string[];
  amountFields: string[];
  badgeField?: string;
  idFields: string[];
}

const TABLE_DISPLAY: Record<string, TableDisplayConfig> = {
  gl: { titleFields: ["description", "gl_desc", "remark", "note"], subtitleFields: ["gl_no", "doc_no", "ref_no", "journal_no"], dateFields: ["gl_date", "date", "doc_date"], amountFields: ["debit", "credit", "amount", "total"], idFields: ["id", "gl_id"] },
  gl_tran: { titleFields: ["account_name", "description", "remark"], subtitleFields: ["account_code", "gl_no", "doc_no"], dateFields: ["date", "gl_date"], amountFields: ["debit", "credit", "amount"], idFields: ["id"] },
  gl_report: { titleFields: ["account_name", "description", "report_name"], subtitleFields: ["account_code", "report_code"], dateFields: ["date", "period"], amountFields: ["debit", "credit", "balance", "amount"], idFields: ["id"] },
  chart_of_account: { titleFields: ["account_name", "name", "name_th"], subtitleFields: ["account_code", "code"], dateFields: [], amountFields: [], badgeField: "account_type", idFields: ["id", "account_code", "code"] },
  mbook: { titleFields: ["book_name", "name", "description"], subtitleFields: ["book_code", "code"], dateFields: [], amountFields: [], idFields: ["id"] },
  contact: { titleFields: ["contact_name", "name", "company_name", "name_th"], subtitleFields: ["tax_id", "contact_code", "code", "phone", "email"], dateFields: [], amountFields: [], badgeField: "contact_type", idFields: ["id", "contact_id"] },
  contact_etax: { titleFields: ["contact_name", "name", "company_name"], subtitleFields: ["tax_id", "branch_no", "branch_name"], dateFields: [], amountFields: [], idFields: ["id"] },
  inventory: { titleFields: ["item_name", "product_name", "name", "description"], subtitleFields: ["item_code", "product_code", "code", "sku", "barcode"], dateFields: [], amountFields: ["price", "cost", "unit_price", "selling_price"], badgeField: "item_type", idFields: ["id", "item_id", "product_id"] },
  inventory_balance: { titleFields: ["item_name", "product_name", "name"], subtitleFields: ["item_code", "product_code", "warehouse"], dateFields: ["date", "last_update"], amountFields: ["quantity", "balance", "qty", "amount", "value"], idFields: ["id"] },
  pack: { titleFields: ["pack_name", "name", "unit_name"], subtitleFields: ["pack_code", "code"], dateFields: [], amountFields: ["ratio", "quantity"], idFields: ["id"] },
  asset: { titleFields: ["asset_name", "name", "description"], subtitleFields: ["asset_code", "code", "asset_no"], dateFields: ["purchase_date", "date", "start_date"], amountFields: ["cost", "value", "accumulated_depreciation", "net_value", "original_cost"], idFields: ["id"] },
  hr_applicant: { titleFields: ["name", "employee_name", "full_name", "first_name"], subtitleFields: ["employee_code", "code", "position", "department", "phone", "email"], dateFields: ["start_date", "hire_date", "date"], amountFields: ["salary", "base_salary"], idFields: ["id"] },
  hr_setting: { titleFields: ["name", "setting_name", "key", "description"], subtitleFields: ["code", "value"], dateFields: [], amountFields: [], idFields: ["id"] },
  drhr_salary: { titleFields: ["employee_name", "name"], subtitleFields: ["employee_code", "code", "period"], dateFields: ["pay_date", "date", "period_date"], amountFields: ["salary", "net_pay", "total", "gross", "deduction"], idFields: ["id"] },
  drhr_attendance: { titleFields: ["employee_name", "name"], subtitleFields: ["employee_code", "code"], dateFields: ["date", "check_in", "check_out", "work_date"], amountFields: ["hours", "work_hours", "ot_hours"], idFields: ["id"] },
  drhr_leave: { titleFields: ["employee_name", "name", "leave_type"], subtitleFields: ["employee_code", "code", "reason"], dateFields: ["start_date", "end_date", "date"], amountFields: ["days", "total_days"], badgeField: "status", idFields: ["id"] },
  drhr_ot: { titleFields: ["employee_name", "name"], subtitleFields: ["employee_code", "code", "ot_type"], dateFields: ["date", "ot_date"], amountFields: ["hours", "ot_hours", "amount", "ot_amount"], badgeField: "status", idFields: ["id"] },
  company_setting: { titleFields: ["company_name", "name", "key", "setting_name"], subtitleFields: ["value", "tax_id", "address", "phone"], dateFields: [], amountFields: [], idFields: ["id"] },
  etax: { titleFields: ["name", "setting_name", "key"], subtitleFields: ["value", "description"], dateFields: [], amountFields: [], idFields: ["id"] },
  category: { titleFields: ["category_name", "name", "description"], subtitleFields: ["category_code", "code", "type"], dateFields: [], amountFields: [], idFields: ["id"] },
  gl_purchase_report: { titleFields: ["description", "account_name", "vendor_name"], subtitleFields: ["account_code", "doc_no", "ref_no"], dateFields: ["date", "doc_date"], amountFields: ["amount", "debit", "credit", "total", "vat"], idFields: ["id"] },
  wht_contact: { titleFields: ["contact_name", "name", "company_name"], subtitleFields: ["tax_id", "address"], dateFields: [], amountFields: ["total", "wht_amount", "amount"], idFields: ["id"] },
  importer: { titleFields: ["name", "file_name", "description", "import_name"], subtitleFields: ["type", "status", "table_name"], dateFields: ["date", "created_at", "import_date"], amountFields: ["row_count", "total_rows"], badgeField: "status", idFields: ["id"] },
};

function stripSuffix(name: string): string {
  return name.replace(/_p\d+of\d+.*$/i, "");
}

function isDocType(tableName: string): boolean {
  return stripSuffix(tableName) in DOC_TABLES;
}

function getDocConfig(tableName: string) {
  return DOC_TABLES[stripSuffix(tableName)];
}

function getDisplayConfig(tableName: string): TableDisplayConfig {
  const base = stripSuffix(tableName);
  if (TABLE_DISPLAY[base]) return TABLE_DISPLAY[base];
  return {
    titleFields: ["name", "description", "title", "label", "item_name", "doc_no"],
    subtitleFields: ["code", "type", "status", "id"],
    dateFields: ["date", "created_at", "doc_date"],
    amountFields: ["amount", "total", "value", "price"],
    idFields: ["id"],
  };
}

function findRealTableName(tables: ZipTable[], baseName: string): string | undefined {
  const exact = tables.find(t => t.name === baseName);
  if (exact) return exact.name;
  const withSuffix = tables.find(t => stripSuffix(t.name) === baseName);
  return withSuffix?.name;
}

function formatNum(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function findVal(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) { if (row[k] && row[k].trim()) return row[k]; }
  return "";
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "success" || s === "paid" || s === "active" || s === "completed")
    return "bg-green-100 text-green-700 border-green-300";
  if (s === "draft" || s === "new")
    return "bg-blue-100 text-blue-700 border-blue-300";
  if (s === "waiting" || s === "pending" || s.includes("รอ"))
    return "bg-amber-100 text-amber-700 border-amber-300";
  if (s === "cancelled" || s === "voided" || s === "void" || s === "rejected" || s === "inactive")
    return "bg-red-100 text-red-700 border-red-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

function InvoicePreview({
  doc,
  items,
  docType,
  companyName,
  onClose,
}: {
  doc: Record<string, string>;
  items: Record<string, string>[];
  docType: string;
  companyName: string;
  onClose: () => void;
}) {
  const config = getDocConfig(docType);
  const docNo = findVal(doc, config?.docNoField || "", "bill_no", "quotation_no", "receipt_no", "payment_no", "expense_no", "po_no", "bn_no", "wht_no", "doc_no", "no") || doc["id"] || "-";
  const docDate = findVal(doc, config?.dateField || "", "bill_date", "quotation_date", "receipt_date", "payment_date", "expense_date", "po_date", "date", "doc_date", "created_at") || "-";
  const contact = findVal(doc, config?.contactField || "", "contact_name", "customer_name", "name", "description") || "-";
  const total = findVal(doc, config?.totalField || "", "grand_total", "total", "net_total", "amount") || "0";
  const subtotal = findVal(doc, "total", "subtotal", "sub_total", "amount", "before_vat") || "0";
  const vat = findVal(doc, "vat", "vat_amount", "vat_total", "tax") || "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Button variant="outline" size="sm" onClick={onClose} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับรายการ
        </Button>
        <Button size="sm" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-print-invoice">
          <Printer className="h-4 w-4 mr-1" />
          พิมพ์เอกสาร
        </Button>
      </div>

      <div className="bg-white border rounded-xl p-6 md:p-8 print-area" id="invoice-print">
        <div className="border-b-2 border-indigo-200 pb-4 mb-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{companyName || "บริษัท"}</h2>
              {doc["address"] && <p className="text-xs text-slate-500 mt-1 max-w-sm">{doc["address"]}</p>}
              {doc["tax_id"] && <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {doc["tax_id"]}</p>}
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-indigo-700 border-2 border-indigo-200 rounded-lg px-4 py-2">{config?.label || "เอกสาร"}</div>
              <div className="text-[10px] text-slate-400 mt-1">ข้อมูลจาก TRCloud Archive</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
          <div className="flex">
            <span className="text-slate-500 w-28 shrink-0">เลขที่เอกสาร:</span>
            <span className="font-semibold" data-testid="text-doc-no">{docNo}</span>
          </div>
          <div className="flex">
            <span className="text-slate-500 w-20 shrink-0">วันที่:</span>
            <span className="font-semibold" data-testid="text-doc-date">{docDate}</span>
          </div>
          <div className="flex col-span-2">
            <span className="text-slate-500 w-28 shrink-0">{stripSuffix(docType) === "expense" ? "รายการ:" : "ลูกค้า/คู่ค้า:"}</span>
            <span className="font-semibold" data-testid="text-doc-contact">{contact}</span>
          </div>
          {doc["credit_days"] && (
            <div className="flex">
              <span className="text-slate-500 w-28 shrink-0">เครดิต:</span>
              <span>{doc["credit_days"]} วัน</span>
            </div>
          )}
          {doc["due_date"] && (
            <div className="flex">
              <span className="text-slate-500 w-20 shrink-0">ครบกำหนด:</span>
              <span>{doc["due_date"]}</span>
            </div>
          )}
          {doc["status"] && (
            <div className="flex">
              <span className="text-slate-500 w-28 shrink-0">สถานะ:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(doc["status"])}`}>{doc["status"]}</span>
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <table className="w-full text-sm border mb-6">
            <thead>
              <tr className="bg-indigo-50">
                <th className="border px-3 py-2 text-center w-10">#</th>
                <th className="border px-3 py-2 text-left">รายการ</th>
                <th className="border px-3 py-2 text-right w-20">จำนวน</th>
                <th className="border px-3 py-2 text-right w-28">ราคา/หน่วย</th>
                <th className="border px-3 py-2 text-right w-28">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="border px-3 py-2 text-center">{i + 1}</td>
                  <td className="border px-3 py-2">{item["item_name"] || item["description"] || item["name"] || item["product_name"] || "-"}</td>
                  <td className="border px-3 py-2 text-right">{item["quantity"] || item["qty"] || "-"}</td>
                  <td className="border px-3 py-2 text-right">{formatNum(item["unit_price"] || item["price"] || item["rate"] || "0")}</td>
                  <td className="border px-3 py-2 text-right">{formatNum(item["amount"] || item["total"] || item["line_total"] || "0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="border rounded-lg p-6 mb-6 text-center text-sm text-slate-400">
            ไม่พบรายการสินค้า/บริการ
          </div>
        )}

        <div className="flex justify-end">
          <div className="w-72 text-sm space-y-1.5 border rounded-lg p-4 bg-slate-50">
            <div className="flex justify-between">
              <span className="text-slate-500">ราคาสินค้า/บริการ</span>
              <span>{formatNum(subtotal)}</span>
            </div>
            {parseFloat(vat) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">ภาษีมูลค่าเพิ่ม 7%</span>
                <span>{formatNum(vat)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 font-bold text-base text-indigo-700">
              <span>ยอดรวม</span>
              <span data-testid="text-doc-total">{formatNum(total)}</span>
            </div>
          </div>
        </div>

        {(doc["remark"] || doc["note"]) && (
          <div className="mt-4 text-xs text-slate-500 border-t pt-3">
            <span className="font-medium">หมายเหตุ:</span> {doc["remark"] || doc["note"]}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordDetailView({
  row,
  tableName,
  onClose,
}: {
  row: Record<string, string>;
  tableName: string;
  onClose: () => void;
}) {
  const entries = Object.entries(row).filter(([, v]) => v && v.trim());
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Button variant="outline" size="sm" onClick={onClose} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับรายการ
        </Button>
        <Button size="sm" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-print-record">
          <Printer className="h-4 w-4 mr-1" />
          พิมพ์
        </Button>
      </div>
      <div className="bg-white border rounded-xl p-6 print-area">
        <h3 className="text-base font-bold text-slate-800 mb-4 pb-3 border-b">{stripSuffix(tableName)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex py-1.5 border-b border-slate-100">
              <span className="text-xs text-slate-500 w-36 shrink-0 font-medium">{key}</span>
              <span className="text-sm text-slate-800 break-all">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SmartRow({
  row,
  index,
  tableName,
  onClick,
}: {
  row: Record<string, string>;
  index: number;
  tableName: string;
  onClick: () => void;
}) {
  const cfg = getDisplayConfig(tableName);
  const title = findVal(row, ...cfg.titleFields) || Object.values(row).find(v => v && v.trim() && v.length > 2) || "-";
  const subtitle = findVal(row, ...cfg.subtitleFields);
  const dateVal = findVal(row, ...cfg.dateFields);
  const id = findVal(row, ...cfg.idFields);
  const amounts = cfg.amountFields.map(f => row[f]).filter(v => v && v.trim() && !isNaN(parseFloat(v)));
  const badge = cfg.badgeField ? row[cfg.badgeField] : (row["status"] || row["state"] || row["type"] || "");

  return (
    <div
      className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b last:border-b-0"
      onClick={onClick}
      data-testid={`row-${index}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 w-6 shrink-0 text-right">{index}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {id && <span className="text-xs text-indigo-600 font-semibold shrink-0">[ {id} ]</span>}
            <span className="text-sm font-medium text-slate-800 truncate">{title}</span>
          </div>
          {(subtitle || dateVal) && (
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
              {dateVal && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateVal}</span>}
              {subtitle && <span className="truncate max-w-xs">{subtitle}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {amounts.length > 0 && (
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-800">{formatNum(amounts[0])}</div>
              {amounts[1] && <div className="text-xs text-slate-500">{formatNum(amounts[1])}</div>}
            </div>
          )}
          {badge && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getStatusColor(badge)}`}>
              {badge}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

function DocRow({
  row,
  index,
  tableName,
  onClick,
}: {
  row: Record<string, string>;
  index: number;
  tableName: string;
  onClick: () => void;
}) {
  const cfg = getDocConfig(tableName)!;
  const docNo = findVal(row, cfg.docNoField, "doc_no", "no") || row["id"] || "-";
  const docDate = findVal(row, cfg.dateField, "date", "doc_date", "created_at") || "-";
  const contact = findVal(row, cfg.contactField, "contact_name", "customer_name", "name") || "-";
  const total = findVal(row, cfg.totalField, "grand_total", "total", "net_total", "amount") || "0";
  const subtotal = findVal(row, "total", "subtotal", "sub_total", "amount", "before_vat") || total;
  const status = findVal(row, "status", "doc_status", "state") || "";
  const refNo = findVal(row, "ref_no", "reference") || "";
  const contactId = findVal(row, "contact_id", "customer_id") || "";
  const remark = findVal(row, "remark", "note") || "";

  return (
    <div
      className="px-4 py-3 hover:bg-indigo-50/40 cursor-pointer transition-colors border-b last:border-b-0"
      onClick={onClick}
      data-testid={`doc-row-${index}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs text-slate-400 mt-1 w-5 shrink-0 text-right">{index}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-indigo-600 font-bold shrink-0">[ {contactId || row["id"] || "-"} ]</span>
            <span className="text-sm font-medium text-slate-800 truncate">{contact}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {docDate}
            </span>
            <span className="font-mono text-indigo-700 font-medium">{docNo}</span>
            {refNo && <span className="text-slate-400">Ref: {refNo}</span>}
          </div>
          {remark && remark !== contact && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-md">{remark}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right min-w-[100px]">
            <div className="text-sm font-semibold text-slate-800">{formatNum(subtotal)}</div>
            {subtotal !== total && <div className="text-xs text-slate-500">{formatNum(total)}</div>}
          </div>
          {status && (
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium min-w-[60px] text-center ${getStatusColor(status)}`}>
              {status}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

export default function LegacyViewerPage() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipInfo, setZipInfo] = useState<ZipInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [selectedDoc, setSelectedDoc] = useState<Record<string, string> | null>(null);
  const [docItems, setDocItems] = useState<Record<string, string>[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "document" | "detail">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const availableMenus = useMemo(() => {
    if (!zipInfo) return [];
    const strippedMap = new Map<string, string>();
    zipInfo.tables.forEach(t => {
      const base = stripSuffix(t.name);
      if (!strippedMap.has(base)) strippedMap.set(base, t.name);
    });

    const usedBases = new Set<string>();

    const menus = MENU_STRUCTURE.map(menu => {
      const children = menu.children
        .filter(child => strippedMap.has(child.tableName))
        .map(child => {
          const realName = strippedMap.get(child.tableName)!;
          usedBases.add(child.tableName);
          const realItemName = child.itemTable ? (strippedMap.get(child.itemTable) || undefined) : undefined;
          return { ...child, tableName: realName, itemTable: realItemName };
        });
      return { ...menu, children };
    }).filter(menu => menu.children.length > 0);

    const unmatchedTables = zipInfo.tables
      .filter(t => {
        const base = stripSuffix(t.name);
        return !usedBases.has(base) && !base.endsWith("_item") && !base.endsWith("_fee");
      })
      .map(t => ({ key: t.name, label: stripSuffix(t.name), tableName: t.name }));

    if (unmatchedTables.length > 0) {
      menus.push({
        key: "other",
        label: "ข้อมูลอื่นๆ",
        icon: FileSpreadsheet,
        children: unmatchedTables,
      });
    }

    return menus;
  }, [zipInfo]);

  const handleZipSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      toast({ title: "กรุณาเลือกไฟล์ .zip", variant: "destructive" });
      return;
    }
    setZipFile(file);
    setLoading(true);
    setZipInfo(null);
    setSelectedTable(null);
    setTableData(null);
    setSelectedDoc(null);
    setExpandedMenus({});

    try {
      const formData = new FormData();
      formData.append("zipFile", file);
      const res = await fetch("/api/legacy-import/read-zip", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setZipInfo(data);
      const autoExpand: Record<string, boolean> = {};
      MENU_STRUCTURE.forEach(m => { autoExpand[m.key] = true; });
      autoExpand["other"] = true;
      setExpandedMenus(autoExpand);
      toast({ title: `เปิด ZIP สำเร็จ — ${data.tables.length} ตาราง` });
    } catch (err: any) {
      toast({ title: "เปิด ZIP ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTable = useCallback(async (tableName: string, menuKey: string, page: number = 1, search: string = "") => {
    if (!zipFile) return;
    setLoadingTable(true);
    setSelectedTable(tableName);
    setSelectedMenuKey(menuKey);
    setSelectedDoc(null);
    setViewMode("list");

    try {
      const formData = new FormData();
      formData.append("zipFile", zipFile);
      formData.append("tableName", tableName);
      formData.append("page", String(page));
      if (search) formData.append("search", search);
      const res = await fetch("/api/legacy-import/read-zip-table", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      setTableData(await res.json());
    } catch (err: any) {
      toast({ title: "โหลดข้อมูลไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTable(false);
    }
  }, [zipFile, toast]);

  const loadDocItems = useCallback(async (doc: Record<string, string>, docType: string, itemTableName?: string) => {
    if (!zipFile) {
      setSelectedDoc(doc);
      setDocItems([]);
      setViewMode("document");
      return;
    }

    const baseDocType = stripSuffix(docType);
    let realItemTable = itemTableName;

    if (!realItemTable && zipInfo) {
      realItemTable = findRealTableName(zipInfo.tables, `${baseDocType}_item`);
    }

    if (!realItemTable || !zipInfo?.tables.some(t => t.name === realItemTable)) {
      setSelectedDoc(doc);
      setDocItems([]);
      setViewMode("document");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("zipFile", zipFile);
      formData.append("tableName", realItemTable);
      formData.append("page", "1");
      formData.append("all", "true");

      const docId = doc["id"] || doc["item_id"] || "";

      const res = await fetch("/api/legacy-import/read-zip-table", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const foreignKeys = [`${baseDocType}_id`, "doc_id", `${baseDocType}Id`];
      const filtered = data.rows.filter((r: Record<string, string>) =>
        foreignKeys.some(fk => r[fk] === docId)
      );

      setSelectedDoc(doc);
      setDocItems(filtered.length > 0 ? filtered : data.rows.filter((r: Record<string, string>) =>
        Object.values(r).includes(docId)
      ));
      setViewMode("document");
    } catch {
      setSelectedDoc(doc);
      setDocItems([]);
      setViewMode("document");
    }
  }, [zipFile, zipInfo]);

  const openRecordDetail = useCallback((row: Record<string, string>) => {
    setSelectedDoc(row);
    setViewMode("detail");
  }, []);

  const toggleMenu = useCallback((key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSearch = useCallback(() => {
    if (selectedTable && selectedMenuKey) {
      loadTable(selectedTable, selectedMenuKey, 1, searchTerm);
    }
  }, [selectedTable, selectedMenuKey, searchTerm, loadTable]);

  const handleClear = useCallback(() => {
    setZipFile(null);
    setZipInfo(null);
    setSelectedTable(null);
    setSelectedMenuKey(null);
    setTableData(null);
    setSearchTerm("");
    setSelectedDoc(null);
    setViewMode("list");
    setExpandedMenus({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const isDoc = selectedTable ? isDocType(selectedTable) : false;

  const currentMenuItem = useMemo(() => {
    if (!selectedMenuKey) return null;
    for (const menu of availableMenus) {
      const child = menu.children.find(c => c.key === selectedMenuKey);
      if (child) return { parent: menu, child };
    }
    return null;
  }, [selectedMenuKey, availableMenus]);

  const pageLabel = currentMenuItem?.child.label || (selectedTable ? stripSuffix(selectedTable) : "");

  return (
    <LegacyLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        {!zipInfo && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-slate-800" data-testid="text-viewer-title">TRCloud Archive Viewer</h1>
              <p className="text-sm text-slate-500 mt-1">เปิดไฟล์ ZIP → ใช้งานเหมือนโปรแกรมบัญชี TRCloud → ค้นหา / ดูเอกสาร / พิมพ์</p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-zip"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-14 w-14 mx-auto text-indigo-500 mb-3 animate-spin" />
                      <p className="text-base font-medium text-slate-600">กำลังอ่าน ZIP...</p>
                    </>
                  ) : (
                    <>
                      <FolderArchive className="h-14 w-14 mx-auto text-slate-400 mb-3" />
                      <p className="text-base font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ ZIP</p>
                      <p className="text-sm text-slate-400 mt-1">เลือกไฟล์ ZIP ที่สร้างไว้ → เปิดใช้งานเหมือน TRCloud เลย</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={handleZipSelect}
                    data-testid="input-zip-file"
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {zipInfo && (
          <div className="flex gap-0 min-h-[80vh]">
            <div className="w-60 shrink-0 bg-slate-800 text-white rounded-l-xl overflow-y-auto no-print flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" data-testid="text-zip-company-name">{zipInfo.companyName || "TRCloud Archive"}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ID: {zipInfo.companyId} • TRCloud</div>
                  </div>
                  <button onClick={handleClear} className="text-slate-400 hover:text-red-400 shrink-0 ml-2" title="ปิด ZIP">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <nav className="py-1 flex-1 overflow-y-auto">
                {availableMenus.map(menu => {
                  const isExpanded = expandedMenus[menu.key] !== false;
                  const MenuIcon = menu.icon;
                  const hasActiveChild = menu.children.some(c => c.key === selectedMenuKey);

                  return (
                    <div key={menu.key}>
                      <button
                        onClick={() => toggleMenu(menu.key)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                          hasActiveChild ? "bg-slate-700/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MenuIcon className="h-4 w-4 text-slate-400" />
                          <span className="text-[13px]">{menu.label}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-500" />
                        ) : (
                          <ChevronRightIcon className="h-3 w-3 text-slate-500" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="bg-slate-900/40">
                          {menu.children.map(child => {
                            const tableInfo = zipInfo.tables.find(t => t.name === child.tableName);
                            const isActive = selectedMenuKey === child.key;
                            return (
                              <button
                                key={child.key}
                                onClick={() => loadTable(child.tableName, child.key)}
                                className={`w-full flex items-center justify-between pl-10 pr-3 py-1.5 text-xs hover:bg-slate-700 transition-colors ${
                                  isActive ? "bg-indigo-600 text-white" : "text-slate-300"
                                }`}
                                data-testid={`menu-${child.key}`}
                              >
                                <span className="truncate">{child.label}</span>
                                <span className={`text-[10px] shrink-0 ml-1 ${isActive ? "text-indigo-200" : "text-slate-500"}`}>
                                  {tableInfo?.rowCount.toLocaleString() || 0}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 text-center">
                  {zipInfo.tables.length} ตาราง • {zipInfo.totalRows.toLocaleString()} แถว
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-r-xl border border-l-0 border-slate-200 overflow-hidden flex flex-col">
              {!selectedTable && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-slate-400 px-8">
                    <Landmark className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-500">เลือกเมนูจากด้านซ้ายเพื่อดูข้อมูล</p>
                    <p className="text-sm mt-2 max-w-md mx-auto">
                      ใช้งานเหมือน TRCloud — กดเมนู เช่น ใบเสนอราคา, ใบแจ้งหนี้
                      <br />กดที่รายการเพื่อดูรายละเอียดและสั่งพิมพ์
                    </p>
                  </div>
                </div>
              )}

              {selectedTable && viewMode === "document" && selectedDoc && (
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                  <InvoicePreview
                    doc={selectedDoc}
                    items={docItems}
                    docType={selectedTable}
                    companyName={zipInfo.companyName}
                    onClose={() => { setSelectedDoc(null); setViewMode("list"); }}
                  />
                </div>
              )}

              {selectedTable && viewMode === "detail" && selectedDoc && (
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                  <RecordDetailView
                    row={selectedDoc}
                    tableName={selectedTable}
                    onClose={() => { setSelectedDoc(null); setViewMode("list"); }}
                  />
                </div>
              )}

              {selectedTable && viewMode === "list" && (
                <div className="flex flex-col flex-1">
                  <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between flex-wrap gap-2 no-print">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-slate-800">{pageLabel}</h2>
                      {isDoc && (
                        <span className="text-xs text-slate-500">
                          {currentMenuItem?.parent.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="คำค้นหา..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-52 h-8 text-sm"
                        data-testid="input-search"
                      />
                      <Button size="sm" onClick={handleSearch} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-search">
                        <Search className="h-3.5 w-3.5 mr-1" />
                        ค้นหา
                      </Button>
                    </div>
                  </div>

                  {tableData && (
                    <div className="px-4 py-1.5 border-b bg-white flex items-center justify-between text-xs text-slate-500 no-print">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          <Hash className="h-3 w-3 inline mr-0.5" />
                          {isDoc ? `${getDocConfig(selectedTable)?.prefix || ""} #` : "#"}
                        </span>
                        {isDoc && (
                          <>
                            <span className="font-medium w-20">วันที่</span>
                            <span className="font-medium">รายละเอียด</span>
                          </>
                        )}
                      </div>
                      <span className="font-medium">{tableData.totalRows.toLocaleString()} รายการ</span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {loadingTable ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                      </div>
                    ) : tableData ? (
                      <>
                        <div data-testid="table-data">
                          {tableData.rows.map((row, i) => {
                            const rowNum = (tableData.page - 1) * 50 + i + 1;
                            if (isDoc) {
                              return (
                                <DocRow
                                  key={i}
                                  row={row}
                                  index={rowNum}
                                  tableName={selectedTable}
                                  onClick={() => loadDocItems(row, selectedTable, currentMenuItem?.child.itemTable)}
                                />
                              );
                            }
                            return (
                              <SmartRow
                                key={i}
                                row={row}
                                index={rowNum}
                                tableName={selectedTable}
                                onClick={() => openRecordDetail(row)}
                              />
                            );
                          })}
                          {tableData.rows.length === 0 && (
                            <div className="px-4 py-16 text-center text-slate-400">ไม่พบข้อมูล</div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>

                  {tableData && tableData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t bg-slate-50 no-print">
                      <span className="text-xs text-slate-500">
                        หน้า {tableData.page} / {tableData.totalPages} ({tableData.totalRows.toLocaleString()} รายการ)
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={tableData.page <= 1}
                          onClick={() => loadTable(selectedTable!, selectedMenuKey!, tableData.page - 1, searchTerm)}
                          className="h-7"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={tableData.page >= tableData.totalPages}
                          onClick={() => loadTable(selectedTable!, selectedMenuKey!, tableData.page + 1, searchTerm)}
                          className="h-7"
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          .print-area { border: none !important; box-shadow: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </LegacyLayout>
  );
}
