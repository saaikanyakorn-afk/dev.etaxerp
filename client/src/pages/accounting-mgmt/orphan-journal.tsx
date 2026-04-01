import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, ArrowLeft, CheckCircle2, AlertCircle, Trash2, FileX } from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "ใบแจ้งหนี้",
  tax_invoice: "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
  purchase_invoice: "ใบแจ้งหนี้ซื้อ",
  expense: "ค่าใช้จ่าย",
  quotation: "ใบเสนอราคา",
  sales_order: "ใบสั่งขาย",
  purchase_order: "ใบสั่งซื้อ",
  deposit_receipt: "ใบรับเงินมัดจำ",
  sales_credit_note: "ใบลดหนี้",
  purchase_debit_note: "ใบเพิ่มหนี้",
  payment_voucher: "ใบสำคัญจ่าย",
  pos_transaction: "POS",
  fixed_asset: "สินทรัพย์ถาวร",
  payroll: "เงินเดือน",
  depreciation: "ค่าเสื่อมราคา",
};

export default function OrphanJournal() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ran, setRan] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/orphan-journal/preview", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/orphan-journal/preview?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryIds: number[]) => {
      const res = await fetch("/api/accounting-mgmt/orphan-journal/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, entryIds }),
        credentials: "include",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "ลบไม่สำเร็จ"); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "ลบสำเร็จ", description: result.message });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = () => { setRan(true); setSelectedIds(new Set()); refetch(); };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.orphans) return;
    if (selectedIds.size === data.orphans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.orphans.map((o: any) => o.id)));
    }
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate([...selectedIds]);
    setConfirmOpen(false);
  };

  const orphans = data?.orphans || [];
  const allSelected = orphans.length > 0 && selectedIds.size === orphans.length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <FileX className="h-5 w-5 text-[#f94d4d]" />
          <h1 className="text-xl font-heading font-bold">ค้นหา GL ไม่มีเอกสาร</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-muted-foreground">
                ค้นหารายการ GL ที่เอกสารต้นทางถูกลบแล้ว (เช่น ใบแจ้งหนี้, ใบกำกับภาษี ถูกลบ แต่รายการในสมุดรายวันยังค้างอยู่)
              </p>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    variant="destructive"
                    size="sm"
                    data-testid="btn-delete-selected"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    ลบที่เลือก ({selectedIds.size})
                  </Button>
                )}
                <Button onClick={handleRun} disabled={isLoading} data-testid="btn-scan">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />} ตรวจสอบ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ran && data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {data.orphanCount === 0 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">ไม่พบ GL ที่ไม่มีเอกสาร (ตรวจสอบ {data.totalChecked} รายการ)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">พบ {data.orphanCount} รายการที่เอกสารต้นทางถูกลบ (จาก {data.totalChecked} รายการ)</span>
                      </div>
                    )}
                  </div>
                  {orphans.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedIds(new Set(orphans.map((o: any) => o.id)));
                        setConfirmOpen(true);
                      }}
                      disabled={deleteMutation.isPending}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      data-testid="btn-delete-all"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> ลบทั้งหมด ({orphans.length})
                    </Button>
                  )}
                </div>

                {orphans.length > 0 && (
                  <div className="overflow-auto max-h-[500px] border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b">
                          <th className="p-2 w-10">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={toggleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </th>
                          <th className="text-left p-2">เลขที่</th>
                          <th className="text-left p-2">วันที่</th>
                          <th className="text-left p-2">ประเภทเอกสาร</th>
                          <th className="text-left p-2">รายละเอียด</th>
                          <th className="text-right p-2">เดบิต</th>
                          <th className="text-right p-2">เครดิต</th>
                          <th className="text-right p-2">บรรทัด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orphans.map((o: any) => (
                          <tr key={o.id} className={`border-b hover:bg-slate-50 ${selectedIds.has(o.id) ? "bg-red-50" : ""}`}>
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(o.id)}
                                onCheckedChange={() => toggleSelect(o.id)}
                                data-testid={`checkbox-entry-${o.id}`}
                              />
                            </td>
                            <td className="p-2 font-mono text-xs">{o.entryNo || `#${o.id}`}</td>
                            <td className="p-2">{o.entryDate}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                {DOC_TYPE_LABELS[o.sourceDocType] || o.sourceDocType} #{o.sourceDocId}
                              </Badge>
                            </td>
                            <td className="p-2 max-w-xs truncate">{o.description || o.reference || "-"}</td>
                            <td className="p-2 text-right font-mono text-xs">{Number(o.totalDebit).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-mono text-xs">{Number(o.totalCredit).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right">{o.lineCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ GL ที่ไม่มีเอกสาร</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>คุณต้องการลบรายการ GL ที่เลือก {selectedIds.size} รายการ</p>
              <p className="text-red-600 font-medium">
                รายการเหล่านี้เป็นรายการที่เอกสารต้นทางถูกลบไปแล้ว การลบจะเป็นการนำออกจากสมุดรายวันถาวร
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" /> ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
