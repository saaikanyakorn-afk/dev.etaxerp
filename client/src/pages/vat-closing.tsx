import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { BookOpen, Calendar, CheckCircle2, AlertCircle, ArrowRight, Loader2, BadgeCheck, FileText, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThaiDateInput from "@/components/thai-date-input";

import { useDateSettings } from "@/hooks/use-date-settings";
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function fmt(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface JournalPreviewLine {
  code: string;
  name: string;
  description: string;
  debit: number;
  credit: number;
}

export default function VatClosing() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editableLines, setEditableLines] = useState<JournalPreviewLine[]>([]);
  const [editableDescription, setEditableDescription] = useState("");
  const [editableDate, setEditableDate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/vat-closing/summary", companyId, month, year],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), month, year });
      const res = await fetch(`/api/vat-closing/summary?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vat-closing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId,
          month: Number(month),
          year: Number(year),
          description: editableDescription,
          entryDate: editableDate,
          lineDescriptions: editableLines.map(l => ({ code: l.code, description: l.description })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "เกิดข้อผิดพลาด");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setShowConfirmDialog(false);
      toast({ title: "สำเร็จ", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/vat-closing/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenConfirm = () => {
    if (!summary?.journalPreview) return;
    setEditableLines(summary.journalPreview.map((l: JournalPreviewLine) => ({ ...l })));
    setEditableDescription(summary.entryDescription || "");
    setEditableDate(summary.entryDate || "");
    setShowConfirmDialog(true);
  };

  const updateLineDescription = (index: number, desc: string) => {
    setEditableLines(prev => prev.map((l, i) => i === index ? { ...l, description: desc } : l));
  };

  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));
  const displayYear = dateEra === "BE" ? String(Number(year) + 543) : year;
  const monthName = THAI_MONTHS[Number(month) - 1] || "";

  const totalOutputVat = summary?.totalOutputVat || 0;
  const totalInputVat = summary?.totalInputVat || 0;
  const vatPayable = summary?.vatPayable || 0;
  const vatRefundable = summary?.vatRefundable || 0;
  const carryForwardReceivable = summary?.carryForwardReceivable || 0;
  const carryForwardUsed = summary?.carryForwardUsed || 0;
  const alreadyClosed = summary?.alreadyClosed || false;
  const hasData = totalOutputVat !== 0 || totalInputVat !== 0;

  const totalPreviewDebit = editableLines.reduce((s, l) => s + l.debit, 0);
  const totalPreviewCredit = editableLines.reduce((s, l) => s + l.credit, 0);

  return (
    <Layout>
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span className="font-medium">การจัดการบัญชี</span>
          <ArrowRight className="h-3 w-3" />
          <h1 className="text-xl font-heading font-medium text-foreground" data-testid="text-page-title">ปิดบัญชีภาษีมูลค่าเพิ่ม (VAT)</h1>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b bg-white">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">เลือกเดือน/ปี:</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36 h-9 bg-white border rounded-lg" data-testid="select-month">
                  <SelectValue placeholder="เลือกเดือน" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24 h-9 bg-white border rounded-lg" data-testid="select-year">
                  <SelectValue placeholder="ปี" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y}>
                      {dateEra === "BE" ? String(Number(y) + 543) : y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">กำลังโหลด...</p>
              </div>
            ) : !hasData && !alreadyClosed ? (
              <div className="py-12 text-center">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm" data-testid="text-no-data">ไม่พบข้อมูลภาษีซื้อหรือภาษีขายในเดือน {monthName} {displayYear}</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-2">
                  <h2 className="text-lg font-semibold">สรุปภาษีมูลค่าเพิ่ม</h2>
                  <p className="text-sm text-muted-foreground">ประจำเดือน {monthName} {displayYear}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-xl p-5 bg-rose-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                        <span className="text-rose-600 font-bold text-xs">ขาย</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-rose-700">ภาษีขาย (Output VAT)</p>
                        <p className="text-[10px] text-muted-foreground">บัญชี 2130, 2131</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-rose-600 text-right" data-testid="text-output-vat">{fmt(totalOutputVat)}</p>
                  </div>

                  <div className="border rounded-xl p-5 bg-blue-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-xs">ซื้อ</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700">ภาษีซื้อ (Input VAT)</p>
                        <p className="text-[10px] text-muted-foreground">บัญชี 1160, 1161</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 text-right" data-testid="text-input-vat">{fmt(totalInputVat)}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="border rounded-xl p-5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">ผลต่าง (ภาษีขาย - ภาษีซื้อ)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fmt(totalOutputVat)} - {fmt(totalInputVat)} = {fmt(totalOutputVat - totalInputVat)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-700">{fmt(totalOutputVat - totalInputVat)}</p>
                      </div>
                    </div>
                  </div>

                  {carryForwardReceivable > 0 && (
                    <div className="border rounded-xl p-5 bg-purple-50/50 border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-700">ลูกหนี้สรรพากรยกมา (1163)</p>
                          <p className="text-xs text-purple-500 mt-1">
                            ยอดสะสมจากเดือนก่อนหน้า
                            {carryForwardUsed > 0 && ` → นำมาหัก ${fmt(carryForwardUsed)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-purple-600" data-testid="text-carry-forward">{fmt(carryForwardReceivable)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-xl p-5 bg-slate-50 border-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {vatPayable > 0 ? "ยอดภาษีที่ต้องชำระสุทธิ" : vatRefundable > 0 ? "ยอดภาษีที่ขอคืนได้" : "ผลสรุป"}
                        </p>
                        {carryForwardUsed > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {fmt(totalOutputVat - totalInputVat)} - {fmt(carryForwardUsed)} (ลูกหนี้ยกมา) = {fmt(vatPayable)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {vatPayable > 0 ? (
                          <div>
                            <p className="text-xs text-rose-600 font-medium">ต้องชำระภาษีเพิ่ม</p>
                            <p className="text-xl font-bold text-rose-600" data-testid="text-vat-result">{fmt(vatPayable)}</p>
                            <p className="text-[10px] text-muted-foreground">บันทึกเจ้าหนี้สรรพากร (2133)</p>
                          </div>
                        ) : vatRefundable > 0 ? (
                          <div>
                            <p className="text-xs text-green-600 font-medium">มีสิทธิ์ขอคืนภาษี</p>
                            <p className="text-xl font-bold text-green-600" data-testid="text-vat-result">{fmt(vatRefundable)}</p>
                            <p className="text-[10px] text-muted-foreground">บันทึกลูกหนี้สรรพากร (1163)</p>
                          </div>
                        ) : (totalOutputVat - totalInputVat) > 0 && carryForwardUsed > 0 ? (
                          <div>
                            <p className="text-xs text-green-600 font-medium">ลูกหนี้ยกมาหักครบ ไม่ต้องจ่ายเพิ่ม</p>
                            <p className="text-xl font-bold text-green-600" data-testid="text-vat-result">0.00</p>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-muted-foreground" data-testid="text-vat-result">0.00</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-4 bg-amber-50/50">
                  <p className="text-sm font-semibold mb-2">รายการบัญชีที่จะบันทึก:</p>
                  <div className="space-y-1 text-xs">
                    {totalOutputVat > 0 && (
                      <div className="flex justify-between">
                        <span>Dr. ภาษีขาย (2130/2131)</span>
                        <span className="font-mono">{fmt(totalOutputVat)}</span>
                      </div>
                    )}
                    {totalInputVat > 0 && (
                      <div className="flex justify-between pl-8">
                        <span>Cr. ภาษีซื้อ (1160/1161)</span>
                        <span className="font-mono">{fmt(totalInputVat)}</span>
                      </div>
                    )}
                    {carryForwardUsed > 0 && (
                      <div className="flex justify-between pl-8 text-purple-700">
                        <span>Cr. ลูกหนี้สรรพากรยกมา (1163)</span>
                        <span className="font-mono">{fmt(carryForwardUsed)}</span>
                      </div>
                    )}
                    {vatPayable > 0 && (
                      <div className="flex justify-between pl-8">
                        <span>Cr. เจ้าหนี้สรรพากร (2133)</span>
                        <span className="font-mono">{fmt(vatPayable)}</span>
                      </div>
                    )}
                    {vatRefundable > 0 && (
                      <div className="flex justify-between">
                        <span>Dr. ลูกหนี้สรรพากร (1163)</span>
                        <span className="font-mono">{fmt(vatRefundable)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {alreadyClosed ? (
                  <div className="flex items-center justify-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <BadgeCheck className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700" data-testid="text-already-closed">
                      เดือน {monthName} {displayYear} ปิดบัญชี VAT เรียบร้อยแล้ว
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white px-8 gap-2"
                      onClick={handleOpenConfirm}
                      data-testid="button-close-vat"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      ปิดบัญชี VAT เดือน {monthName}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-[var(--theme-primary)]" />
              ตรวจสอบรายการบัญชีก่อนบันทึก
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบและแก้ไขคำอธิบายรายการได้ก่อนกดยืนยัน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 min-w-[100px]">เลขที่อ้างอิง:</label>
                <span className="text-sm font-mono bg-slate-100 px-3 py-1 rounded" data-testid="text-ref-no">
                  {summary?.entryReference || ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 min-w-[100px]">วันที่บันทึก:</label>
                <ThaiDateInput
                  value={editableDate}
                  onChange={setEditableDate}
                  dateEra={dateEra}
                  dateFmt={dateFmt}
                  className="w-44 bg-white"
                  data-testid="input-entry-date"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Pencil className="h-3 w-3" />
                  คำอธิบายหลัก:
                </label>
                <Input
                  value={editableDescription}
                  onChange={e => setEditableDescription(e.target.value)}
                  className="bg-white"
                  data-testid="input-entry-description"
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--theme-primary)]/10 border-b">
                    <th className="text-left p-2.5 font-medium text-slate-700 w-20">รหัส</th>
                    <th className="text-left p-2.5 font-medium text-slate-700">คำอธิบายรายการ</th>
                    <th className="text-right p-2.5 font-medium text-slate-700 w-28">เดบิต</th>
                    <th className="text-right p-2.5 font-medium text-slate-700 w-28">เครดิต</th>
                  </tr>
                </thead>
                <tbody>
                  {editableLines.map((line, i) => (
                    <tr key={i} className={`border-b last:border-b-0 ${line.credit > 0 ? "bg-white" : "bg-white"}`}>
                      <td className="p-2.5">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{line.code.replace("_cf", "")}</span>
                      </td>
                      <td className="p-1.5">
                        <Input
                          value={line.description}
                          onChange={e => updateLineDescription(i, e.target.value)}
                          className="h-8 text-sm bg-white border-slate-200"
                          data-testid={`input-line-desc-${i}`}
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm">
                        {line.debit > 0 ? fmt(line.debit) : ""}
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm">
                        {line.credit > 0 ? fmt(line.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 font-semibold">
                    <td colSpan={2} className="p-2.5 text-right text-slate-600">รวม</td>
                    <td className="p-2.5 text-right font-mono">{fmt(totalPreviewDebit)}</td>
                    <td className="p-2.5 text-right font-mono">{fmt(totalPreviewCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {summary?.missingAccounts?.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">ไม่พบบัญชีในผังบัญชี:</p>
                  {summary.missingAccounts.map((acc: string, i: number) => (
                    <p key={i} className="text-sm text-red-600">- {acc}</p>
                  ))}
                  <p className="text-xs text-red-500 mt-1">กรุณาเพิ่มบัญชีในผังบัญชีก่อนปิดบัญชี VAT</p>
                </div>
              </div>
            )}

            {Math.abs(totalPreviewDebit - totalPreviewCredit) < 0.01 ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">ยอดเดบิตและเครดิตสมดุล</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">ยอดเดบิตและเครดิตไม่สมดุล (ต่าง {fmt(Math.abs(totalPreviewDebit - totalPreviewCredit))})</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} data-testid="button-cancel-close">
              ยกเลิก
            </Button>
            <Button
              className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white gap-2"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending || (summary?.missingAccounts?.length > 0)}
              data-testid="button-confirm-close"
            >
              {closeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              ยืนยันปิดบัญชี VAT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
