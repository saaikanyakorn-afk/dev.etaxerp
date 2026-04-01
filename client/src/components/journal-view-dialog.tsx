import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Loader2 } from "lucide-react";

interface JournalLine {
  accountCode?: string;
  accountName?: string;
  accountNameTh?: string;
  description?: string;
  debit: string;
  credit: string;
}

interface JournalData {
  id: number;
  reference?: string;
  description?: string;
  entryDate: string;
  journalBook?: string;
  status: string;
  lines: JournalLine[];
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const bookLabels: Record<string, string> = {
  general: "ทั่วไป",
  receive: "รับเงิน",
  payment: "จ่ายเงิน",
  sales: "ขาย",
  purchase: "ซื้อ",
};

export default function JournalViewDialog({
  open,
  onOpenChange,
  docType,
  docId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: string;
  docId: number;
}) {
  const [data, setData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !docId) return;
    setLoading(true);
    setNotFound(false);
    setData(null);
    (async () => {
      try {
        const res = await fetch(`/api/journal-entries/by-source/${docType}/${docId}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (json) {
            setData(json);
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [open, docType, docId]);

  const totalDebit = data?.lines?.reduce((s, l) => s + parseFloat(l.debit || "0"), 0) || 0;
  const totalCredit = data?.lines?.reduce((s, l) => s + parseFloat(l.credit || "0"), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="journal-view-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#fb9678]/10">
              <BookOpen className="w-4 h-4 text-[#fb9678]" />
            </div>
            ดูบัญชี - บันทึกรายการบัญชี
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#fb9678]" />
            <span className="ml-2 text-sm text-slate-500">กำลังโหลด...</span>
          </div>
        )}

        {notFound && (
          <div className="text-center py-8 text-slate-400 text-sm">
            ยังไม่มีรายการบัญชีสำหรับเอกสารนี้
          </div>
        )}

        {data && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
              {data.reference && (
                <div><span className="text-slate-400">เลขที่:</span> <span className="font-medium">{data.reference}</span></div>
              )}
              <div><span className="text-slate-400">วันที่:</span> {data.entryDate}</div>
              {data.journalBook && (
                <div><span className="text-slate-400">สมุด:</span> {bookLabels[data.journalBook] || data.journalBook}</div>
              )}
              {data.description && (
                <div><span className="text-slate-400">คำอธิบาย:</span> {data.description}</div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] h-10">
                    <TableHead className="text-white text-sm font-bold w-24">รหัสบัญชี</TableHead>
                    <TableHead className="text-white text-sm font-bold">ชื่อบัญชี</TableHead>
                    <TableHead className="text-white text-sm font-bold w-32 text-right">เดบิต</TableHead>
                    <TableHead className="text-white text-sm font-bold w-32 text-right">เครดิต</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines?.map((line, i) => (
                    <TableRow key={i} className="h-10 hover:bg-orange-50/50">
                      <TableCell className="text-sm font-mono text-slate-600">{line.accountCode || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {line.accountNameTh || line.accountName || "-"}
                        {line.accountName && line.accountNameTh && (
                          <span className="text-xs text-slate-400 ml-2">({line.accountName})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">
                        {parseFloat(line.debit || "0") > 0 ? (
                          <span className="text-blue-600">{fmt(line.debit)}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">
                        {parseFloat(line.credit || "0") > 0 ? (
                          <span className="text-red-500">{fmt(line.credit)}</span>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-bold border-t-2">
                    <TableCell colSpan={2} className="text-sm text-right text-slate-700">รวม</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-blue-600">{fmt(totalDebit)}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-red-500">{fmt(totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
