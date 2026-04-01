import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  X,
  FlaskConical,
  Clock,
} from "lucide-react";
import EDocumentActions from "@/components/e-document-actions";

interface TestDoc {
  id: number;
  taxInvoiceNo: string;
  customerName: string;
  totalAmount: string;
  status: string;
  createdAt: string;
}

export default function PdfStressTestPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteDocNo, setDeleteDocNo] = useState("");

  const { data: testDocs, isLoading } = useQuery<TestDoc[]>({
    queryKey: ["/api/dev/pdf-test-docs"],
    queryFn: async () => {
      const res = await fetch("/api/dev/pdf-test-docs", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.docs || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (itemCount: number) => {
      const res = await fetch("/api/dev/create-pdf-test-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemCount }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "สร้างเอกสารทดสอบสำเร็จ", description: data.message, variant: "success" as any });
      queryClient.invalidateQueries({ queryKey: ["/api/dev/pdf-test-docs"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/dev/delete-pdf-test-doc/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "ลบสำเร็จ", description: data.message, variant: "success" as any });
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/dev/pdf-test-docs"] });
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const docs = testDocs || [];

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FlaskConical className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">ทดสอบ PDF Stress Test</h1>
            <p className="text-sm text-gray-500">สร้างเอกสารทดสอบขนาดใหญ่ เพื่อทดสอบการสร้าง PDF และ error handling</p>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-amber-800">วิธีทดสอบ:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-700">
                    <li>กดปุ่ม <strong>"สร้างเอกสารทดสอบ"</strong> เพื่อสร้างใบกำกับภาษีที่มี 150 รายการ (~10 วินาทีในการสร้าง PDF)</li>
                    <li>กดปุ่ม <strong>"ดาวน์โหลด PDF"</strong> — จะแสดงตัวนับเวลา</li>
                    <li><strong>ถอดสาย LAN</strong> ระหว่างที่กำลังสร้าง (ก่อน 10 วินาที) เพื่อทดสอบ error handling</li>
                    <li>ดู <strong>dialog แจ้ง error</strong> ที่ปรากฏ — มีปุ่ม "ลองใหม่"</li>
                    <li>ต่อสาย LAN กลับ แล้วกด <strong>"ลองใหม่"</strong></li>
                    <li>เมื่อทดสอบเสร็จ กดปุ่ม <strong>"ลบเอกสารทดสอบ"</strong> (ลบจริง ไม่ใช่ soft delete)</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {docs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="inline-flex p-4 bg-gray-100 rounded-full">
                <FileText className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <p className="text-gray-600 font-medium">ยังไม่มีเอกสารทดสอบ</p>
                <p className="text-sm text-gray-400 mt-1">กดปุ่มด้านล่างเพื่อสร้างใบกำกับภาษีทดสอบ 150 รายการ</p>
              </div>
              <Button
                onClick={() => createMutation.mutate(150)}
                disabled={createMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                data-testid="btn-create-test-doc"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                สร้างเอกสารทดสอบ (150 รายการ)
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {docs.map((doc) => (
              <Card key={doc.id} className="border-blue-200">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <span className="font-bold text-lg" data-testid={`text-doc-no-${doc.id}`}>{doc.taxInvoiceNo}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">TEST</span>
                      </div>
                      <div className="text-sm text-gray-500 space-y-0.5">
                        <p>{doc.customerName}</p>
                        <p>ยอดรวม: {parseFloat(doc.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</p>
                        <p className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          สร้างเมื่อ: {doc.createdAt ? new Date(doc.createdAt).toLocaleString("th-TH") : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <EDocumentActions
                        documentType="tax_invoice"
                        documentId={doc.id}
                        docNo={doc.taxInvoiceNo}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => { setDeleteConfirmId(doc.id); setDeleteDocNo(doc.taxInvoiceNo); }}
                        data-testid={`btn-delete-test-doc-${doc.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบเอกสารทดสอบ
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                ยืนยันลบเอกสารทดสอบ
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  ลบเอกสาร <strong>{deleteDocNo}</strong> และรายการทั้งหมดออกจากระบบ
                </p>
                <p className="text-sm text-red-600 mt-1 font-medium">
                  การลบนี้เป็นการลบถาวร (Hard Delete) — ไม่สามารถกู้คืนได้
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
                data-testid="btn-confirm-delete"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                ลบถาวร
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
