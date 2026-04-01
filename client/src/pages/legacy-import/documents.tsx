import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import LegacyLayout from "@/components/legacy-layout";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Loader2,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Printer,
  Building2,
} from "lucide-react";
import { useThemeColor } from "@/hooks/use-theme-color";

const DOC_TYPE_CONFIG: Record<string, { label: string; prefix: string; color: string }> = {
  quotation: { label: "ใบเสนอราคา", prefix: "QO", color: "#fec90f" },
  bill: { label: "ใบแจ้งหนี้ / ใบกำกับภาษี", prefix: "IV", color: "#05b187" },
  bn: { label: "ใบวางบิล", prefix: "BN", color: "#539BFF" },
  receipt: { label: "ใบเสร็จรับเงิน", prefix: "RC", color: "#03c9d7" },
  po: { label: "ใบสั่งซื้อ", prefix: "PO", color: "#667eea" },
  expense: { label: "ค่าใช้จ่าย", prefix: "EX", color: "#f94d4d" },
  payment: { label: "ใบสำคัญจ่าย", prefix: "PV", color: "#fb9678" },
  wht: { label: "หัก ณ ที่จ่าย", prefix: "WT", color: "#9c27b0" },
};

function formatNum(val: string | null | undefined): string {
  if (!val) return "0.00";
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusStyle(status: string | null | undefined): string {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s === "approved" || s === "paid" || s === "active" || s === "completed" || s === "success")
    return "bg-green-100 text-green-700";
  if (s === "draft" || s === "new")
    return "bg-blue-100 text-blue-700";
  if (s === "waiting" || s === "pending" || s.includes("รอ"))
    return "bg-amber-100 text-amber-700";
  if (s === "cancelled" || s === "voided" || s === "void" || s === "rejected")
    return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

interface LegacyDoc {
  id: number;
  docType: string;
  docNo: string | null;
  docDate: string | null;
  contactName: string | null;
  contactCode: string | null;
  description: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  grandTotal: string | null;
  status: string | null;
  rawData: any;
}

interface LegacyDocItem {
  id: number;
  lineNo: number | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string | null;
  unit: string | null;
  rawData: any;
}

const PAGE_SIZE = 20;

function DocumentList({ docType }: { docType: string }) {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const config = DOC_TYPE_CONFIG[docType] || { label: docType, prefix: "", color: "#667eea" };

  const { data: documents = [], isLoading } = useQuery<LegacyDoc[]>({
    queryKey: ["/api/legacy-import/documents", selectedId, docType],
    queryFn: async () => {
      if (!selectedId) return [];
      const res = await fetch(`/api/legacy-import/documents?legacyCompanyId=${selectedId}&docType=${docType}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(d =>
      (d.docNo || "").toLowerCase().includes(q) ||
      (d.contactName || "").toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q) ||
      (d.grandTotal || "").includes(q)
    );
  }, [documents, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!selectedId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Building2 className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">กรุณาเลือกบริษัทจาก sidebar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: config.color }}>
            {config.prefix}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800" data-testid="text-doc-type-title">{config.label}</h1>
            <p className="text-xs text-slate-400">{selectedCompany?.name} — {filtered.length} รายการ</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="ค้นหาเลขที่ / คู่ค้า / จำนวนเงิน..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
          data-testid="input-doc-search"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : paged.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {documents.length === 0 ? "ยังไม่มีเอกสารประเภทนี้" : "ไม่พบรายการที่ค้นหา"}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">เลขที่เอกสาร</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">วันที่</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{docType === "expense" ? "รายละเอียด" : "คู่ค้า"}</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">จำนวนเงิน</th>
                    {documents.some(d => d.status) && (
                      <th className="text-center px-4 py-3 font-medium text-slate-600">สถานะ</th>
                    )}
                    <th className="text-center px-4 py-3 font-medium text-slate-600 w-16">ดู</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((doc, i) => (
                    <tr
                      key={doc.id}
                      className="border-b hover:bg-slate-50/80 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/legacy-import/documents/${doc.id}`)}
                      data-testid={`row-doc-${doc.id}`}
                    >
                      <td className="px-4 py-3 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800" data-testid={`text-docno-${doc.id}`}>{doc.docNo || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{doc.docDate || "-"}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{doc.contactName || doc.description || "-"}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800">{formatNum(doc.grandTotal)}</td>
                      {documents.some(d => d.status) && (
                        <td className="px-4 py-3 text-center">
                          {doc.status ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(doc.status)}`}>{doc.status}</span>
                          ) : "-"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <Eye className="h-4 w-4 text-slate-400 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>หน้า {page}/{totalPages} ({filtered.length} รายการ)</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DocumentDetail({ docId }: { docId: number }) {
  const [, setLocation] = useLocation();
  const { selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();

  const { data, isLoading } = useQuery<{ document: LegacyDoc; items: LegacyDocItem[] }>({
    queryKey: ["/api/legacy-import/documents", docId],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/documents/${docId}`);
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-400">ไม่พบเอกสาร</div>
    );
  }

  const { document: doc, items } = data;
  const config = DOC_TYPE_CONFIG[doc.docType] || { label: doc.docType, prefix: "", color: "#667eea" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation(`/legacy-import/documents/type/${doc.docType}`)}
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับรายการ {config.label}
        </Button>
        <Button size="sm" onClick={() => window.print()} style={{ background: themeColors.primary }} className="text-white" data-testid="button-print-doc">
          <Printer className="h-4 w-4 mr-1" />
          พิมพ์
        </Button>
      </div>

      <div className="bg-white border rounded-xl p-6 md:p-8 print-area" id="doc-print">
        <div className="border-b-2 pb-4 mb-5" style={{ borderColor: config.color + "40" }}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{selectedCompany?.name || "บริษัท"}</h2>
              {(doc.rawData as any)?.["address"] && <p className="text-xs text-slate-500 mt-1 max-w-sm">{(doc.rawData as any)["address"]}</p>}
              {(doc.rawData as any)?.["tax_id"] && <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {(doc.rawData as any)["tax_id"]}</p>}
            </div>
            <div className="text-right">
              <div className="text-base font-bold border-2 rounded-lg px-4 py-2" style={{ color: config.color, borderColor: config.color + "60" }}>
                {config.label}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">ข้อมูลจาก TRCloud Archive</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
          <div className="flex">
            <span className="text-slate-500 w-28 shrink-0">เลขที่เอกสาร:</span>
            <span className="font-semibold" data-testid="text-detail-docno">{doc.docNo || "-"}</span>
          </div>
          <div className="flex">
            <span className="text-slate-500 w-20 shrink-0">วันที่:</span>
            <span className="font-semibold" data-testid="text-detail-date">{doc.docDate || "-"}</span>
          </div>
          <div className="flex col-span-2">
            <span className="text-slate-500 w-28 shrink-0">{doc.docType === "expense" ? "รายละเอียด:" : "ลูกค้า/คู่ค้า:"}</span>
            <span className="font-semibold" data-testid="text-detail-contact">{doc.contactName || "-"}</span>
          </div>
          {(doc.rawData as any)?.["credit_days"] && (
            <div className="flex">
              <span className="text-slate-500 w-28 shrink-0">เครดิต:</span>
              <span>{(doc.rawData as any)["credit_days"]} วัน</span>
            </div>
          )}
          {(doc.rawData as any)?.["due_date"] && (
            <div className="flex">
              <span className="text-slate-500 w-20 shrink-0">ครบกำหนด:</span>
              <span>{(doc.rawData as any)["due_date"]}</span>
            </div>
          )}
          {doc.status && (
            <div className="flex">
              <span className="text-slate-500 w-28 shrink-0">สถานะ:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(doc.status)}`}>{doc.status}</span>
            </div>
          )}
          {doc.description && doc.docType !== "expense" && (
            <div className="flex col-span-2">
              <span className="text-slate-500 w-28 shrink-0">หมายเหตุ:</span>
              <span className="text-slate-600">{doc.description}</span>
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <table className="w-full text-sm border mb-6">
            <thead>
              <tr style={{ background: config.color + "15" }}>
                <th className="border px-3 py-2 text-center w-10">#</th>
                {items.some(it => it.itemCode) && <th className="border px-3 py-2 text-left w-24">รหัส</th>}
                <th className="border px-3 py-2 text-left">รายการ</th>
                <th className="border px-3 py-2 text-right w-20">จำนวน</th>
                {items.some(it => it.unit) && <th className="border px-3 py-2 text-center w-16">หน่วย</th>}
                <th className="border px-3 py-2 text-right w-28">ราคา/หน่วย</th>
                <th className="border px-3 py-2 text-right w-28">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50" data-testid={`row-item-${item.id}`}>
                  <td className="border px-3 py-2 text-center">{item.lineNo || i + 1}</td>
                  {items.some(it => it.itemCode) && <td className="border px-3 py-2 text-slate-500 text-xs">{item.itemCode || "-"}</td>}
                  <td className="border px-3 py-2">{item.itemName || item.description || "-"}</td>
                  <td className="border px-3 py-2 text-right">{item.quantity || "-"}</td>
                  {items.some(it => it.unit) && <td className="border px-3 py-2 text-center text-xs">{item.unit || "-"}</td>}
                  <td className="border px-3 py-2 text-right">{formatNum(item.unitPrice)}</td>
                  <td className="border px-3 py-2 text-right">{formatNum(item.amount)}</td>
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
            {doc.subtotal && (
              <div className="flex justify-between">
                <span className="text-slate-500">ราคาสินค้า/บริการ</span>
                <span>{formatNum(doc.subtotal)}</span>
              </div>
            )}
            {doc.vatAmount && parseFloat(doc.vatAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">ภาษีมูลค่าเพิ่ม 7%</span>
                <span>{formatNum(doc.vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 font-bold text-base" style={{ color: config.color }}>
              <span>ยอดรวม</span>
              <span data-testid="text-detail-total">{formatNum(doc.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [matchList, paramsList] = useRoute("/legacy-import/documents/type/:docType");
  const [matchDetail, paramsDetail] = useRoute("/legacy-import/documents/:id");

  let content;
  if (matchDetail && paramsDetail?.id && !/^type$/.test(paramsDetail.id)) {
    const docId = parseInt(paramsDetail.id);
    if (!isNaN(docId)) {
      content = <DocumentDetail docId={docId} />;
    }
  } else if (matchList && paramsList?.docType) {
    content = <DocumentList docType={paramsList.docType} />;
  } else {
    content = (
      <div className="text-center py-20 text-slate-400">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>เลือกประเภทเอกสารจากเมนูด้านซ้าย</p>
      </div>
    );
  }

  return <LegacyLayout>{content}</LegacyLayout>;
}
