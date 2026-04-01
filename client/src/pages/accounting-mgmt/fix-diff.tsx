import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Zap, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function FixDiff() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/fix-diff/preview", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/fix-diff/preview?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/fix-diff/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, entries: data?.entries }),
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
          <Zap className="h-5 w-5 text-slate-800" />
          <h1 className="text-xl font-heading font-bold">Fix Diff (0.01 &gt; x &gt; 0.0001)</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">แก้ไขรายการบัญชีที่มีผลต่างจากการปัดเศษ (น้อยกว่า 0.01 บาท)</p>
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
                  <p className="text-muted-foreground">รายการที่มีผลต่างเล็กน้อย</p>
                </div>

                {data.entries?.length > 0 && (
                  <>
                    <div className="overflow-auto max-h-[400px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b">
                            <th className="text-left p-2">เลขที่</th>
                            <th className="text-left p-2">วันที่</th>
                            <th className="text-right p-2">ผลต่าง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.entries.map((e: any) => (
                            <tr key={e.entryId} className="border-b hover:bg-slate-50">
                              <td className="p-2 font-mono">{e.entryNo || `#${e.entryId}`}</td>
                              <td className="p-2">{e.entryDate}</td>
                              <td className="p-2 text-right font-mono text-amber-600">{e.diff.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} className="bg-slate-800 hover:bg-slate-700" data-testid="btn-execute">
                        {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        แก้ไขทั้งหมด
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
