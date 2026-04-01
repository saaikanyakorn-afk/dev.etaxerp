import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Anchor, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function ChangeAnchor() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [oldAnchor, setOldAnchor] = useState("");
  const [newAnchor, setNewAnchor] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/change-anchor/preview", companyId, oldAnchor],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (oldAnchor) params.set("oldAnchor", oldAnchor);
      const res = await fetch(`/api/accounting-mgmt/change-anchor/preview?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/change-anchor/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, oldAnchor, newAnchor }),
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
          <Anchor className="h-5 w-5 text-rose-400" />
          <h1 className="text-xl font-heading font-bold">Change Anchor</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm">Anchor เดิม</span>
                <Input value={oldAnchor} onChange={e => setOldAnchor(e.target.value)} placeholder="เว้นว่างเพื่อดูทั้งหมด" className="w-48" data-testid="input-old-anchor" />
              </div>
              <Button onClick={() => refetch()} disabled={isLoading} data-testid="btn-search">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} ค้นหา
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data && (
              <div className="space-y-4">
                {data.anchors?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Anchor ที่พบ ({data.totalLines} รายการ)</p>
                    <div className="flex flex-wrap gap-2">
                      {data.anchors.map((a: any) => (
                        <Button key={a.anchor} variant={oldAnchor === a.anchor ? "default" : "outline"} size="sm"
                          onClick={() => { setOldAnchor(a.anchor); refetch(); }} data-testid={`btn-anchor-${a.anchor}`}>
                          {a.anchor} ({a.count})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {oldAnchor && data.totalLines > 0 && (
                  <div className="flex items-center gap-4 border-t pt-4">
                    <span className="text-sm">เปลี่ยนเป็น</span>
                    <Input value={newAnchor} onChange={e => setNewAnchor(e.target.value)} placeholder="Anchor ใหม่" className="w-48" data-testid="input-new-anchor" />
                    <Button onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending || !oldAnchor} className="bg-rose-400 hover:bg-rose-500" data-testid="btn-execute">
                      {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      เปลี่ยน ({data.totalLines} รายการ)
                    </Button>
                  </div>
                )}

                {data.lines?.length > 0 && (
                  <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">Anchor</th>
                          <th className="text-left p-2">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lines.map((l: any) => (
                          <tr key={l.id} className="border-b hover:bg-slate-50">
                            <td className="p-2 font-mono">#{l.id}</td>
                            <td className="p-2 font-mono">{l.anchor}</td>
                            <td className="p-2 max-w-xs truncate">{l.description}</td>
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
    </Layout>
  );
}
