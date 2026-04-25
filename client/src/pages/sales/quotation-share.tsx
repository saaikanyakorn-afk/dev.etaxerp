import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Edit3, Printer, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuotationShare() {
  const { token } = useParams<{ token: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const [responseType, setResponseType] = useState("");
  const [note, setNote] = useState("");
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const { toast } = useToast();

  const pdfUrl = `/api/share/quotation/${token}/pdf`;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/quote/${token}`);
        if (!res.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        const d = await res.json();
        setMeta({ quotationNo: d.quotationNo, customerResponse: d.customerResponse });
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
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถส่งการตอบกลับได้", variant: "destructive" });
    }
    setResponding(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  const alreadyResponded = meta?.customerResponse;

  return (
    <div className="min-h-screen bg-slate-700">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{meta?.quotationNo || "ใบเสนอราคา"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => iframeRef.current?.contentWindow?.print()}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <a href={pdfUrl} download>
            <Button
              size="sm"
              className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs"
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">ดาวน์โหลด PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full max-w-4xl border-0"
          style={{ height: "calc(100vh - 160px)", minHeight: "600px" }}
          title="ใบเสนอราคา"
        />

        <div className="w-full max-w-4xl bg-white border-t shadow-sm print:hidden">
          <div className="p-6">
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
    </div>
  );
}
