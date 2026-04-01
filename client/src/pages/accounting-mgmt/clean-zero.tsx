import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Wrench, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function CleanZero() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/clean-zero/preview", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/clean-zero/preview?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/clean-zero/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
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
          <Wrench className="h-5 w-5 text-amber-400" />
          <h1 className="text-xl font-heading font-bold">ล้างข้อมูลรายการบัญชี 0</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">ค้นหาและลบรายการบัญชีที่มียอด Dr=0 และ Cr=0</p>
              <Button onClick={() => { setRan(true); refetch(); }} disabled={isLoading} data-testid="btn-scan">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} สแกน
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ran && data && (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-6 text-center">
                  <p className="text-3xl font-bold">{data.count}</p>
                  <p className="text-muted-foreground">รายการที่มียอด 0 บาท</p>
                </div>

                {data.count > 0 && (
                  <>
                    {data.lines?.length > 0 && (
                      <div className="overflow-auto max-h-[300px]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b">
                              <th className="text-left p-2">ID</th>
                              <th className="text-left p-2">Journal Entry</th>
                              <th className="text-left p-2">รายละเอียด</th>
                              <th className="text-right p-2">Dr</th>
                              <th className="text-right p-2">Cr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.lines.map((l: any) => (
                              <tr key={l.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 font-mono">#{l.id}</td>
                                <td className="p-2 font-mono">#{l.journalEntryId}</td>
                                <td className="p-2 max-w-xs truncate">{l.description}</td>
                                <td className="p-2 text-right">{l.debit}</td>
                                <td className="p-2 text-right">{l.credit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} variant="destructive" data-testid="btn-execute">
                        {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        ลบรายการ 0 ทั้งหมด
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
