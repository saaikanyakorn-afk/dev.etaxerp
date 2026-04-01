import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { BookOpen, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function GlNoDoc() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/gl-no-doc", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/gl-no-doc?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <BookOpen className="h-5 w-5 text-[#03c9d7]" />
          <h1 className="text-xl font-heading font-bold">GL NO DOC</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">ค้นหารายการบัญชีที่ไม่มีเอกสารอ้างอิง (ไม่มี reference และ sourceDocType)</p>
              <Button onClick={() => { setRan(true); refetch(); }} disabled={isLoading} data-testid="btn-search">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookOpen className="h-4 w-4 mr-1" />} ค้นหา
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ran && data && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {data.count === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">ทุกรายการมีเอกสารอ้างอิง</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">พบ {data.count} รายการที่ไม่มีเอกสารอ้างอิง</span>
                    </div>
                  )}
                </div>

                {data.entries?.length > 0 && (
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">เลขที่</th>
                          <th className="text-left p-2">วันที่</th>
                          <th className="text-left p-2">รายละเอียด</th>
                          <th className="text-left p-2">อ้างอิง</th>
                          <th className="text-left p-2">ประเภทเอกสาร</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.entries.map((e: any) => (
                          <tr key={e.id} className="border-b hover:bg-slate-50">
                            <td className="p-2 font-mono">#{e.id}</td>
                            <td className="p-2">{e.entryNo || "-"}</td>
                            <td className="p-2">{e.entryDate}</td>
                            <td className="p-2 max-w-xs truncate">{e.description}</td>
                            <td className="p-2 text-muted-foreground">{e.reference || "-"}</td>
                            <td className="p-2 text-muted-foreground">{e.sourceDocType || "-"}</td>
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
