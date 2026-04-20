import { useState } from "react";
import { useLocation } from "wouter";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Download, Printer, Send, Search, Receipt, FileText, Calendar,
  CheckCircle2, Mail, MessageSquare, ExternalLink, BookOpen, Sparkles, ArrowRight,
} from "lucide-react";

interface ReceiptItem {
  id: string;
  rdReceiptNo: string;
  rdRefNo: string;
  clientName: string;
  taxId: string;
  formType: string;
  period: string;
  receiptDate: string;
  amount: number;
  surcharge: number;
  fine: number;
  total: number;
  paymentChannel: string;
  journalEntryId?: string;
  distributionStatus: "pending" | "sent-email" | "sent-line" | "downloaded";
}

const MOCK_RECEIPTS: ReceiptItem[] = [
  { id: "r1", rdReceiptNo: "RD-262603-0001234", rdRefNo: "0126030001234", clientName: "บริษัท เทคโนโลยีไทย จำกัด", taxId: "0105563087654", formType: "PP30", period: "2026-02", receiptDate: "2026-03-22 10:14", amount: 156780, surcharge: 0, fine: 0, total: 156780, paymentChannel: "Direct Debit (KBANK)", journalEntryId: "JV-2026-03-0089", distributionStatus: "sent-email" },
  { id: "r2", rdReceiptNo: "RD-262603-0001245", rdRefNo: "0126030001245", clientName: "บริษัท ครีเอทีฟดีไซน์ จำกัด", taxId: "0105567043210", formType: "PP30", period: "2026-02", receiptDate: "2026-03-22 11:32", amount: 34500, surcharge: 0, fine: 0, total: 34500, paymentChannel: "QR Payment", journalEntryId: "JV-2026-03-0091", distributionStatus: "sent-line" },
  { id: "r3", rdReceiptNo: "RD-262603-0001256", rdRefNo: "0126030001256", clientName: "บริษัท สยามทรัพย์ จำกัด", taxId: "0105560054321", formType: "PND1", period: "2026-02", receiptDate: "2026-03-07 14:08", amount: 28400, surcharge: 142, fine: 0, total: 28542, paymentChannel: "Bank Transfer", journalEntryId: "JV-2026-03-0067", distributionStatus: "downloaded" },
  { id: "r4", rdReceiptNo: "RD-262602-0009876", rdRefNo: "0126020009876", clientName: "บริษัท ไอทีโซลูชั่น จำกัด", taxId: "0105570010987", formType: "PP30", period: "2026-01", receiptDate: "2026-02-23 09:45", amount: 23100, surcharge: 0, fine: 0, total: 23100, paymentChannel: "Direct Debit (BBL)", journalEntryId: "JV-2026-02-0123", distributionStatus: "sent-email" },
  { id: "r5", rdReceiptNo: "RD-262603-0001267", rdRefNo: "0126030001267", clientName: "บริษัท เอบีซี จำกัด", taxId: "0105561012345", formType: "PP30", period: "2026-03", receiptDate: "2026-04-20 14:35", amount: 28450, surcharge: 0, fine: 0, total: 28450, paymentChannel: "Direct Debit (KBANK)", distributionStatus: "pending" },
];

const JOURNAL_TEMPLATE = [
  { account: "2151", name: "ภาษีมูลค่าเพิ่ม - ภาษีขาย", debit: 126000, credit: 0 },
  { account: "1151", name: "ภาษีมูลค่าเพิ่ม - ภาษีซื้อ", debit: 0, credit: 97550 },
  { account: "2152", name: "ภาษีมูลค่าเพิ่มค้างจ่าย", debit: 0, credit: 28450 },
];

const PAYMENT_TEMPLATE = [
  { account: "2152", name: "ภาษีมูลค่าเพิ่มค้างจ่าย", debit: 28450, credit: 0 },
  { account: "1111", name: "เงินฝากธนาคาร - กสิกรไทย", debit: 0, credit: 28450 },
];

export default function EfilingReceipts() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(MOCK_RECEIPTS[0]);

  const filtered = MOCK_RECEIPTS.filter(r =>
    !search || r.clientName.includes(search) || r.taxId.includes(search) || r.rdReceiptNo.includes(search)
  );

  return (
    <EtaxCenterLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/etax-hub/efiling")} data-testid="btn-back-dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" />กลับ
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-2" data-testid="text-receipts-title">
              ใบเสร็จและการบันทึกบัญชี
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              ดาวน์โหลดใบเสร็จจาก RD • ส่งให้ลูกค้า • บันทึกบัญชีอัตโนมัติเข้า journal entry
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="btn-bulk-distribute">
              <Send className="w-4 h-4 mr-2" />ส่งใบเสร็จยกชุด
            </Button>
            <Button variant="outline" data-testid="btn-export-all">
              <Download className="w-4 h-4 mr-2" />Export ทั้งหมด
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Receipt List */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">ใบเสร็จที่ออกแล้ว</CardTitle>
                <Badge variant="outline">{MOCK_RECEIPTS.length} ใบ</Badge>
              </div>
              <div className="relative mt-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="ค้นหา..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-receipts"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[700px] overflow-y-auto">
              {filtered.map((r) => {
                const isSelected = selectedReceipt?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReceipt(r)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${isSelected ? "bg-orange-50 border-l-4 border-l-[#fb9678]" : ""}`}
                    data-testid={`receipt-item-${r.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{r.clientName}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{r.rdReceiptNo}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-xs font-normal">{r.formType}</Badge>
                          <span className="text-xs text-gray-500">งวด {r.period}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm tabular-nums">฿{r.total.toLocaleString()}</p>
                        <DistributionBadge status={r.distributionStatus} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Receipt Detail */}
          {selectedReceipt && (
            <div className="lg:col-span-3 space-y-4">
              <Tabs defaultValue="receipt">
                <TabsList className="bg-white border-0 shadow-sm">
                  <TabsTrigger value="receipt" data-testid="tab-receipt">📄 ใบเสร็จ RD</TabsTrigger>
                  <TabsTrigger value="journal" data-testid="tab-journal">📚 บันทึกบัญชี</TabsTrigger>
                  <TabsTrigger value="distribute" data-testid="tab-distribute">📤 ส่งให้ลูกค้า</TabsTrigger>
                </TabsList>

                <TabsContent value="receipt">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <ReceiptPreview receipt={selectedReceipt} />
                      <div className="flex gap-2 mt-6">
                        <Button variant="outline" data-testid="btn-receipt-download"><Download className="w-4 h-4 mr-2" />ดาวน์โหลด PDF</Button>
                        <Button variant="outline" data-testid="btn-receipt-print"><Printer className="w-4 h-4 mr-2" />พิมพ์</Button>
                        <Button variant="outline" data-testid="btn-receipt-form-image"><FileText className="w-4 h-4 mr-2" />ดาวน์โหลดภาพแบบ</Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="journal">
                  <JournalTab receipt={selectedReceipt} />
                </TabsContent>

                <TabsContent value="distribute">
                  <DistributeTab receipt={selectedReceipt} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </EtaxCenterLayout>
  );
}

function ReceiptPreview({ receipt }: { receipt: ReceiptItem }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <div className="text-center border-b pb-4">
        <p className="text-xs text-gray-500">กรมสรรพากร</p>
        <h3 className="text-xl font-bold text-gray-800 mt-1">ใบเสร็จรับเงิน</h3>
        <p className="text-xs text-gray-500">RECEIPT</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
        <Field label="เลขที่ใบเสร็จ" value={<code className="font-mono text-xs">{receipt.rdReceiptNo}</code>} />
        <Field label="วันที่ออก" value={receipt.receiptDate} />
        <Field label="ผู้เสียภาษี" value={receipt.clientName} />
        <Field label="เลขประจำตัวผู้เสียภาษี" value={<code className="font-mono text-xs">{receipt.taxId}</code>} />
        <Field label="แบบแสดงรายการ" value={receipt.formType} />
        <Field label="งวดภาษี" value={receipt.period} />
        <Field label="หมายเลขอ้างอิงแบบ" value={<code className="font-mono text-xs">{receipt.rdRefNo}</code>} />
        <Field label="ช่องทางชำระ" value={receipt.paymentChannel} />
      </div>

      <div className="mt-6 border-t pt-4 space-y-2 text-sm">
        <Row label="จำนวนภาษี" value={receipt.amount} />
        {receipt.surcharge > 0 && <Row label="เงินเพิ่ม" value={receipt.surcharge} />}
        {receipt.fine > 0 && <Row label="ค่าปรับอาญา" value={receipt.fine} />}
        <div className="border-t pt-2">
          <Row label="รวมทั้งสิ้น" value={receipt.total} bold />
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-gray-400 border-t pt-4">
        <p>ใบเสร็จออกอัตโนมัติจากกรมสรรพากร ผ่าน RD Open API</p>
        <p className="mt-1">/oapi/receipt-form • E-Tax Center (OA1-...)</p>
      </div>
    </div>
  );
}

function JournalTab({ receipt }: { receipt: ReceiptItem }) {
  const [postedToBooks, setPostedToBooks] = useState(!!receipt.journalEntryId);

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              บันทึกบัญชีอัตโนมัติ
            </span>
            {postedToBooks ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                <CheckCircle2 className="w-3 h-3 mr-1" />บันทึกแล้ว: {receipt.journalEntryId || "JV-2026-04-0125"}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">รอบันทึก</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* JV 1: ตอนยื่นแบบ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">📝 รายการที่ 1: ตอนยื่นแบบ ภ.พ.30 (ปรับปรุงรอชำระ)</h4>
              <span className="text-xs text-gray-500">JV-2026-04-0124 • 20/04/2569</span>
            </div>
            <JournalTable rows={JOURNAL_TEMPLATE} />
          </div>

          {/* JV 2: ตอนชำระจริง */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">💰 รายการที่ 2: ตอนชำระเงิน + รับใบเสร็จ</h4>
              <span className="text-xs text-gray-500">JV-2026-04-0125 • {receipt.receiptDate}</span>
            </div>
            <JournalTable rows={PAYMENT_TEMPLATE} />
          </div>

          {/* Auto-mapping rules */}
          <div className="bg-violet-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-violet-900 mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />กฎ auto-mapping ที่ใช้
            </p>
            <ul className="text-xs text-violet-800 space-y-1 ml-5 list-disc">
              <li>ดึงยอดภาษีขายจาก <code className="bg-white px-1 rounded">tax_invoices</code> ที่ออกในงวด {receipt.period}</li>
              <li>ดึงยอดภาษีซื้อจาก <code className="bg-white px-1 rounded">purchase_invoices</code> + <code className="bg-white px-1 rounded">expenses</code> ที่ vat_eligible = true</li>
              <li>เลขบัญชี 2151/1151/2152 จากการตั้งค่า Chart of Accounts ของลูกค้า</li>
              <li>เลขบัญชีเงินฝาก {receipt.paymentChannel.includes("KBANK") ? "1111 (KBANK)" : "ตามช่องทางชำระ"}</li>
            </ul>
          </div>

          <div className="flex gap-2">
            {!postedToBooks ? (
              <Button className="flex-1 bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => setPostedToBooks(true)} data-testid="btn-post-journal">
                <BookOpen className="w-4 h-4 mr-2" />บันทึกเข้าระบบบัญชี
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" data-testid="btn-view-jv" onClick={() => window.location.href = `/journal/edit/${receipt.journalEntryId || "1"}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />ดูใน Journal Entry
                </Button>
                <Button variant="outline" data-testid="btn-edit-mapping">
                  แก้ไข mapping
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DistributeTab({ receipt }: { receipt: ReceiptItem }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">ส่งใบเสร็จให้ลูกค้า</CardTitle>
        <p className="text-xs text-gray-500 mt-1">ตามข้อตกลง ภ.อ.01.2 ข้อ 3.4 — ต้องส่งใบเสร็จให้ลูกค้าภายใน 7 วัน</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <DistMethodCard
          icon={<Mail className="w-5 h-5 text-blue-600" />}
          title="อีเมล"
          desc="contact@abccompany.com (จากข้อมูลลูกค้า)"
          status={receipt.distributionStatus === "sent-email" ? "sent" : "ready"}
          testId="dist-email"
        />
        <DistMethodCard
          icon={<MessageSquare className="w-5 h-5 text-green-600" />}
          title="LINE Official Account"
          desc="เชื่อมโยงกับ LINE ID ของลูกค้า"
          status={receipt.distributionStatus === "sent-line" ? "sent" : "ready"}
          testId="dist-line"
        />
        <DistMethodCard
          icon={<ExternalLink className="w-5 h-5 text-violet-600" />}
          title="Client Portal"
          desc="ลูกค้าเข้ามาดาวน์โหลดเองได้ที่ portal.etax-center.co.th"
          status="ready"
          testId="dist-portal"
        />

        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium mb-2">ข้อความที่จะส่ง</p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200">
            <p>เรียน ลูกค้า {receipt.clientName}</p>
            <p className="mt-2">บริษัทฯ ได้ดำเนินการยื่นแบบ {receipt.formType} งวด {receipt.period} เรียบร้อยแล้ว</p>
            <p className="mt-2">ยอดภาษีที่ชำระ: <strong>฿{receipt.total.toLocaleString()}</strong></p>
            <p className="mt-2">เลขที่ใบเสร็จ RD: <code>{receipt.rdReceiptNo}</code></p>
            <p className="mt-2">กรุณาดาวน์โหลดใบเสร็จและภาพแบบจากลิงก์แนบ</p>
            <p className="mt-2">ขอบคุณค่ะ<br/>E-Tax Center (ประเทศไทย)</p>
          </div>
        </div>

        <Button className="w-full bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="btn-send-receipt">
          <Send className="w-4 h-4 mr-2" />ส่งใบเสร็จไปยังช่องทางที่เลือก
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">฿{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    </div>
  );
}

function DistributionBadge({ status }: { status: ReceiptItem["distributionStatus"] }) {
  const config = {
    "pending": { label: "รอส่ง", color: "bg-gray-100 text-gray-600" },
    "sent-email": { label: "ส่งอีเมลแล้ว", color: "bg-blue-100 text-blue-700" },
    "sent-line": { label: "ส่ง LINE แล้ว", color: "bg-green-100 text-green-700" },
    "downloaded": { label: "ลูกค้าดาวน์โหลดแล้ว", color: "bg-emerald-100 text-emerald-700" },
  }[status];
  return <Badge variant="outline" className={`${config.color} text-xs font-normal mt-1 border-0`}>{config.label}</Badge>;
}

function JournalTable({ rows }: { rows: { account: string; name: string; debit: number; credit: number }[] }) {
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-gray-600">เลขที่บัญชี</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">ชื่อบัญชี</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">เดบิต</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">เครดิต</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs">{r.account}</td>
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.debit > 0 ? r.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.credit > 0 ? r.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 border-t-2 border-gray-300 font-medium">
            <td colSpan={2} className="px-3 py-2 text-right">รวม</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DistMethodCard({ icon, title, desc, status, testId }: any) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3" data-testid={testId}>
      <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      {status === "sent" ? (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
          <CheckCircle2 className="w-3 h-3 mr-1" />ส่งแล้ว
        </Badge>
      ) : (
        <Button size="sm" variant="outline">เลือก</Button>
      )}
    </div>
  );
}
