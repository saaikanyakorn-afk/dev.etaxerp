import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
const JOURNAL_BOOKS: Record<string, { num: string; label: string }> = {
  general: { num: "1", label: "สมุดรายวันทั่วไป" },
  receive: { num: "2", label: "สมุดรายวันรับเงิน" },
  payment: { num: "3", label: "สมุดรายวันจ่ายเงิน" },
  sales: { num: "4", label: "สมุดรายวันขาย" },
  purchase: { num: "5", label: "สมุดรายวันซื้อ" },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JournalPrint() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/journal/print/:id");
  const entryId = params?.id ? Number(params.id) : null;
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: entryData, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/journal-entries", entryId],
    queryFn: async () => {
      if (!entryId) return null;
      const res = await fetch(`/api/journal-entries/${entryId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!entryId,
  });

  const entry = entryData;
  const lines = entryData?.lines || [];

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p>กำลังโหลด...</p>
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="p-8 text-center">
        <p>ไม่พบรายการบัญชี</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/journal")} className="mt-4">กลับ</Button>
      </div>
    );
  }

  const book = JOURNAL_BOOKS[entry.journalBook] || JOURNAL_BOOKS.general;
  const totalDebit = lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden p-4 bg-gray-50 border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/journal")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับ
        </Button>
        <Button size="sm" onClick={() => window.print()} className="bg-[var(--theme-primary)] hover:bg-blue-600 text-white gap-1" data-testid="button-print">
          <Printer className="h-4 w-4" />
          พิมพ์
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto p-8 print:p-6 print:max-w-none">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold">{selectedCompany?.nameTh || selectedCompany?.name || "บริษัท"}</h1>
          <h2 className="text-base font-semibold mt-1">ใบสำคัญ{book.label}</h2>
          <p className="text-sm text-gray-600">เล่มที่ {book.num}</p>
        </div>

        <div className="flex justify-between text-sm mb-4">
          <div className="space-y-0.5">
            <div>
              <span className="font-medium">เลขที่: </span>
              <span className="font-semibold">{entry.entryNo || "-"}</span>
            </div>
            <div>
              <span className="font-medium">เลขที่อ้างอิง: </span>
              <span>{entry.reference || "-"}</span>
            </div>
          </div>
          <div>
            <span className="font-medium">วันที่: </span>
            <span>{formatDate(entry.entryDate, dateEra, dateFmt)}</span>
          </div>
        </div>

        {entry.description && (
          <div className="text-sm mb-4">
            <span className="font-medium">คำอธิบาย: </span>
            <span>{entry.description}</span>
          </div>
        )}

        {entry.contactName && (
          <div className="text-sm mb-4">
            <span className="font-medium">ผู้ติดต่อ: </span>
            <span>{entry.contactName}</span>
          </div>
        )}

        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-center w-24">รหัสบัญชี</th>
              <th className="border border-gray-400 px-3 py-2 text-left">ชื่อบัญชี</th>
              <th className="border border-gray-400 px-3 py-2 text-right w-32">เดบิต</th>
              <th className="border border-gray-400 px-3 py-2 text-right w-32">เครดิต</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line: any) => (
              <tr key={line.id}>
                <td className="border border-gray-400 px-3 py-1.5 text-center">{line.accountCode || "-"}</td>
                <td className="border border-gray-400 px-3 py-1.5">
                  {line.accountName || line.description || "-"}
                  {line.description && line.accountName && line.description !== line.accountName && (
                    <span className="text-gray-500 ml-1">({line.description})</span>
                  )}
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-right">{fmt(line.debit)}</td>
                <td className="border border-gray-400 px-3 py-1.5 text-right">{fmt(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold">
              <td className="border border-gray-400 px-3 py-2" colSpan={2} style={{ textAlign: "right" }}>รวม</td>
              <td className="border border-gray-400 px-3 py-2 text-right">{fmt(totalDebit)}</td>
              <td className="border border-gray-400 px-3 py-2 text-right">{fmt(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-12 flex justify-between text-sm print:mt-16">
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-1"></div>
            <p>ผู้จัดทำ</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-1"></div>
            <p>ผู้ตรวจสอบ</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-1"></div>
            <p>ผู้อนุมัติ</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:p-6 { padding: 1.5rem; }
          .print\\:max-w-none { max-width: none; }
          .print\\:mt-16 { margin-top: 4rem; }
        }
      `}</style>
    </div>
  );
}