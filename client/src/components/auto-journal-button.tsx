import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight, Check, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AutoJournalButtonProps {
  documentType: "invoice" | "tax_invoice" | "receipt" | "purchase" | "deposit" | "purchase_deposit" | "credit_note" | "debit_note" | "expense" | "payment";
  documentId: number;
  companyId: number;
  disabled?: boolean;
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AutoJournalButton({ documentType, documentId, companyId, disabled }: AutoJournalButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myPermissions } = useQuery<{ modules: string[]; subModules: string[] }>({
    queryKey: ["/api/permissions/me", companyId],
    queryFn: async () => {
      const params = companyId ? `?companyId=${companyId}` : "";
      const r = await fetch(`/api/permissions/me${params}`, { credentials: "include" });
      if (!r.ok) return { modules: [], subModules: [] };
      const data = await r.json();
      if (Array.isArray(data)) return { modules: data, subModules: [] };
      return data;
    },
    enabled: !!companyId,
  });
  const hasAccounting = myPermissions?.modules?.includes("accounting") ?? false;

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ["/api/journal-entries/preview-from-document", documentType, documentId, companyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/journal-entries/preview-from-document?documentType=${documentType}&documentId=${documentId}&companyId=${companyId}`,
        { credentials: "include" }
      );
      return res.json();
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/journal-entries/from-document", {
        documentType, documentId, companyId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({ title: "บันทึกบัญชีสำเร็จ", description: `สร้างรายการบัญชี #${data.id}` });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const totalDebit = preview?.lines?.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0) || 0;
  const totalCredit = preview?.lines?.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0) || 0;

  if (!hasAccounting) return null;

  return (
    <>
      <Button
        data-testid="button-auto-journal"
        variant="outline"
        size="sm"
        className="h-9 px-4 gap-1.5 border-[var(--theme-primary)]/30 text-[var(--theme-primary)] hover:bg-[#eef4ff]"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <BookOpen className="h-3.5 w-3.5" />
        บันทึกบัญชี
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[var(--theme-primary)]" />
              ตรวจสอบรายการบัญชีก่อนบันทึก
            </DialogTitle>
            <DialogDescription>
              ระบบจะสร้างรายการสมุดบัญชีรายวันจากเอกสารนี้โดยอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              กำลังโหลด...
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </div>
          )}

          {preview && !preview.available && (
            <div className="bg-amber-50 text-amber-700 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {preview.message}
            </div>
          )}

          {preview?.available && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  สูตร: {preview.formulaName}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  เอกสาร: {preview.documentNo}
                </Badge>
                {preview.isForeignCurrency && (
                  <Badge className="bg-[#eef4ff] text-[var(--theme-primary)] text-xs">
                    {preview.currencyCode} → THB @{preview.exchangeRate}
                  </Badge>
                )}
              </div>

              {preview.isForeignCurrency && (
                <div className="bg-[#eef4ff] border border-[var(--theme-primary)]/20 rounded-lg p-3 text-sm text-[var(--theme-primary)]">
                  <strong>แปลงสกุลเงิน:</strong> ยอดในเอกสารเป็น {preview.currencyCode} จะถูกแปลงเป็นบาท (THB) ด้วยอัตราแลกเปลี่ยน {preview.exchangeRate} ก่อนบันทึกบัญชี
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs w-20">รหัสบัญชี</TableHead>
                      <TableHead className="text-xs">ชื่อบัญชี</TableHead>
                      {preview.isForeignCurrency && (
                        <TableHead className="text-xs text-right w-28">ยอด {preview.currencyCode}</TableHead>
                      )}
                      <TableHead className="text-xs text-right w-28">เดบิต (THB)</TableHead>
                      <TableHead className="text-xs text-right w-28">เครดิต (THB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.lines.map((line: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{line.accountCode}</TableCell>
                        <TableCell className="text-xs">{line.accountName}</TableCell>
                        {preview.isForeignCurrency && (
                          <TableCell className="text-xs text-right tabular-nums text-[var(--theme-primary)]">
                            {line.originalDebit && parseFloat(line.originalDebit) > 0 ? fmt(line.originalDebit) : ""}
                            {line.originalCredit && parseFloat(line.originalCredit) > 0 ? fmt(line.originalCredit) : ""}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-right tabular-nums font-medium">
                          {parseFloat(line.debit) > 0 ? fmt(line.debit) : ""}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">
                          {parseFloat(line.credit) > 0 ? fmt(line.credit) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={preview.isForeignCurrency ? 3 : 2} className="text-xs text-right">รวม</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(totalDebit)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <Check className="h-4 w-4" />
                  เดบิต = เครดิต (สมดุล)
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  เดบิต ≠ เครดิต (ไม่สมดุล — ผลต่าง {fmt(Math.abs(totalDebit - totalCredit))})
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  ยกเลิก
                </Button>
                <Button
                  data-testid="button-confirm-journal"
                  size="sm"
                  variant="info" className="gap-1.5"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังบันทึก...</>
                  ) : (
                    <><BookOpen className="h-3.5 w-3.5" /> ยืนยันบันทึกบัญชี</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
