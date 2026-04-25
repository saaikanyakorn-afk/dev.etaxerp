import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Edit3, Printer, Download, Loader2, FileText } from "lucide-react";
import DocumentRenderer from "@/components/document-renderer";
import { downloadPdfFromElement } from "@/lib/download-pdf";

export default function QuotationShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const [responseType, setResponseType] = useState("");
  const [note, setNote] = useState("");
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/quote/${token}`);
        if (!res.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [token]);

  async function handleRespond(type: string) {
    if (type !== "confirmed" && !showNoteFor) {
      setShowNoteFor(type);
      return;
    }
    setResponding(true);
    try {
      const res = await fetch(`/api/share/quote/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: type, note }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      setResponded(true);
      setResponseType(type);
    } catch {}
    setResponding(false);
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPdfFromElement("doc-print-area", `${data?.quotationNo || "quotation"}.pdf`);
    } catch {}
    setDownloading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  if (!data) return null;

  const docSettings = data.documentSettings || {};
  const alreadyResponded = data.customerResponse;

  return (
    <div className="min-h-screen bg-slate-700 print:bg-white">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{data.quotationNo || "ใบเสนอราคา"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { const prev = document.title; document.title = data?.quotationNo || "quotation"; window.print(); setTimeout(() => { document.title = prev; }, 1000); }}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs"
            data-testid="button-download-pdf"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{downloading ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}</span>
            <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4 print:!py-0 print:!px-0 print:!max-w-none print:!m-0 overflow-x-auto">
        <div id="doc-print-area">
          <DocumentRenderer
            settings={docSettings}
            company={data.company}
            quotation={data}
            documentType="quotation"
            userSignature={data.userSignature}
          />
        </div>

        <div className="mt-4 bg-white rounded-lg shadow-sm border p-6 print:hidden">
          {responded ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <div className="text-lg font-medium text-slate-700">
                {responseType === "confirmed" && "ยืนยันใบเสนอราคาเรียบร้อยแล้ว"}
                {responseType === "cancelled" && "ปฏิเสธใบเสนอราคาแล้ว"}
                {responseType === "request_edit" && "ส่งคำขอแก้ไขเรียบร้อยแล้ว"}
              </div>
              <p className="text-sm text-slate-500 mt-1">ขอบคุณสำหรับการตอบกลับ</p>
            </div>
          ) : alreadyResponded ? (
            <div className="text-center py-4">
              <Badge className="text-sm py-1 px-4">
                {alreadyResponded === "confirmed" ? "ยืนยันแล้ว" : alreadyResponded === "cancelled" ? "ปฏิเสธแล้ว" : "ส่งคำขอแก้ไขแล้ว"}
              </Badge>
              <p className="text-sm text-slate-500 mt-2">เอกสารนี้ได้รับการตอบกลับแล้ว</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center text-sm text-slate-600 font-medium">กรุณายืนยันใบเสนอราคา</div>

              {showNoteFor && (
                <div className="max-w-md mx-auto space-y-2">
                  <Textarea
                    data-testid="input-response-note"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={showNoteFor === "request_edit" ? "ระบุสิ่งที่ต้องการแก้ไข..." : "ระบุเหตุผล (ถ้ามี)..."}
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNoteFor(null)}>ยกเลิก</Button>
                    <Button size="sm" onClick={() => handleRespond(showNoteFor)} disabled={responding}>
                      {responding ? "กำลังส่ง..." : "ส่ง"}
                    </Button>
                  </div>
                </div>
              )}

              {!showNoteFor && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    data-testid="button-confirm"
                    onClick={() => handleRespond("confirmed")}
                    disabled={responding}
                    className="gap-2 px-6"
                  >
                    <CheckCircle2 className="h-4 w-4" /> ยืนยัน
                  </Button>
                  <Button
                    data-testid="button-request-edit"
                    variant="outline"
                    onClick={() => handleRespond("request_edit")}
                    disabled={responding}
                    className="gap-2 px-6 border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Edit3 className="h-4 w-4" /> ขอแก้ไข
                  </Button>
                  <Button
                    data-testid="button-cancel"
                    variant="outline"
                    onClick={() => handleRespond("cancelled")}
                    disabled={responding}
                    className="gap-2 px-6 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" /> ปฏิเสธ
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
