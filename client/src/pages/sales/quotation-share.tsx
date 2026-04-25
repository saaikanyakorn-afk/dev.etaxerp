import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Edit3, Loader2 } from "lucide-react";
import PdfIframeViewer from "@/components/pdf-iframe-viewer";

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

  useEffect(() => {
    fetch(`/api/share/quote/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("ไม่พบเอกสาร หรือลิงก์หมดอายุ"))
      .then(d => setData(d))
      .catch(e => setError(typeof e === "string" ? e : "ไม่พบเอกสาร"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRespond(type: string) {
    if (type !== "confirmed" && !showNoteFor) { setShowNoteFor(type); return; }
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

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  if (!data) return null;

  const alreadyResponded = data.customerResponse;
  const docNo = data.quotationNo || "ใบเสนอราคา";

  const responseSection = (
    <div className="bg-white border-t border-slate-200 p-4 print:hidden">
      {responded ? (
        <div className="text-center py-3">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
          <div className="text-base font-medium text-slate-700">
            {responseType === "confirmed" && "ยืนยันใบเสนอราคาเรียบร้อยแล้ว"}
            {responseType === "cancelled" && "ปฏิเสธใบเสนอราคาแล้ว"}
            {responseType === "request_edit" && "ส่งคำขอแก้ไขเรียบร้อยแล้ว"}
          </div>
          <p className="text-sm text-slate-500 mt-1">ขอบคุณสำหรับการตอบกลับ</p>
        </div>
      ) : alreadyResponded ? (
        <div className="text-center py-3">
          <Badge className="text-sm py-1 px-4">
            {alreadyResponded === "confirmed" ? "ยืนยันแล้ว" : alreadyResponded === "cancelled" ? "ปฏิเสธแล้ว" : "ส่งคำขอแก้ไขแล้ว"}
          </Badge>
          <p className="text-sm text-slate-500 mt-2">เอกสารนี้ได้รับการตอบกลับแล้ว</p>
        </div>
      ) : (
        <div className="space-y-3">
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
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : "ส่ง"}
                </Button>
              </div>
            </div>
          )}
          {!showNoteFor && (
            <div className="flex items-center justify-center gap-3">
              <Button data-testid="button-confirm" onClick={() => handleRespond("confirmed")} disabled={responding} className="gap-2 px-6">
                <CheckCircle2 className="h-4 w-4" /> ยืนยัน
              </Button>
              <Button data-testid="button-request-edit" variant="outline" onClick={() => handleRespond("request_edit")} disabled={responding} className="gap-2 px-6 border-amber-300 text-amber-700 hover:bg-amber-50">
                <Edit3 className="h-4 w-4" /> ขอแก้ไข
              </Button>
              <Button data-testid="button-cancel" variant="outline" onClick={() => handleRespond("cancelled")} disabled={responding} className="gap-2 px-6 border-red-300 text-red-600 hover:bg-red-50">
                <XCircle className="h-4 w-4" /> ปฏิเสธ
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-700">
      <div className="flex-1">
        <PdfIframeViewer
          pdfUrl={`/api/share/quotation/${token}/pdf?view=1`}
          downloadUrl={`/api/share/quotation/${token}/pdf`}
          title={docNo}
          filename={`${docNo}.pdf`}
        />
      </div>
      {responseSection}
    </div>
  );
}
