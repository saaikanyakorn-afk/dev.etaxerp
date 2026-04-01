import { useState } from "react";
import Layout from "@/components/layout";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Scissors, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function TrimData() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const { toast } = useToast();
  const [beforeDate, setBeforeDate] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/trim-data/preview", companyId, beforeDate],
    queryFn: async () => {
      if (!companyId || !beforeDate) return null;
      const res = await fetch(`/api/accounting-mgmt/trim-data/preview?companyId=${companyId}&beforeDate=${beforeDate}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId && !!beforeDate,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/trim-data/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, beforeDate }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
      setShowConfirm(false);
      refetch();
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <Scissors className="h-5 w-5 text-rose-500" />
          <h1 className="text-xl font-heading font-bold">TRIM DATA</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">ลบข้อมูลก่อนวันที่</span>
              <ThaiDateInput value={beforeDate} onChange={setBeforeDate} dateEra={dateEra} dateFmt={dateFmt} className="w-52" data-testid="input-before-date" />
              <Button onClick={() => refetch()} disabled={isLoading || !beforeDate} data-testid="btn-preview">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} ดูตัวอย่าง
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data && (
              <div className="space-y-4">
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 text-center">
                  <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-rose-700">พบข้อมูลที่จะถูกลบ</p>
                  <div className="mt-3 grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <div className="bg-white rounded p-3">
                      <p className="text-2xl font-bold text-rose-600">{data.entryCount}</p>
                      <p className="text-sm text-muted-foreground">รายการบัญชี</p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="text-2xl font-bold text-rose-600">{data.lineCount}</p>
                      <p className="text-sm text-muted-foreground">รายการย่อย</p>
                    </div>
                  </div>
                </div>
                {data.entryCount > 0 && (
                  <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => setShowConfirm(true)} data-testid="btn-execute">
                      <AlertTriangle className="h-4 w-4 mr-1" /> ลบข้อมูล
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบข้อมูล</DialogTitle>
            <DialogDescription>การดำเนินการนี้ไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่?</DialogDescription>
          </DialogHeader>
          <p className="text-sm">จะลบรายการบัญชี <strong>{data?.entryCount}</strong> รายการ ก่อนวันที่ {beforeDate}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} data-testid="btn-confirm-delete">
              {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} ยืนยันลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
