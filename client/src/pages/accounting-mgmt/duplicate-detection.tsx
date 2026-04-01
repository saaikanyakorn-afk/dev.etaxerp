import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Files, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function DuplicateDetection() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/duplicate-detection", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/duplicate-detection?companyId=${companyId}`, { credentials: "include" });
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
          <Files className="h-5 w-5 text-[#03c9d7]" />
          <h1 className="text-xl font-heading font-bold">ค้นหารายการบัญชีซ้ำ</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">ค้นหารายการที่มีวันที่ เอกสารอ้างอิง และรายละเอียดเหมือนกัน</p>
              <Button onClick={() => { setRan(true); refetch(); }} disabled={isLoading} data-testid="btn-run">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Files className="h-4 w-4 mr-1" />} ค้นหา
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ran && data && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {data.duplicateGroupCount === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">ไม่พบรายการซ้ำ จาก {data.totalEntries} รายการ</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">พบ {data.duplicateGroupCount} กลุ่มที่อาจซ้ำ</span>
                    </div>
                  )}
                </div>

                {data.duplicateGroups?.map((group: any, i: number) => (
                  <Card key={i} className="border-amber-200">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-amber-700 mb-2">กลุ่มที่ {i + 1} ({group.count} รายการ)</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-1">ID</th>
                            <th className="text-left p-1">เลขที่</th>
                            <th className="text-left p-1">วันที่</th>
                            <th className="text-left p-1">อ้างอิง</th>
                            <th className="text-left p-1">รายละเอียด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((e: any) => (
                            <tr key={e.id} className="border-b hover:bg-amber-50">
                              <td className="p-1 font-mono">#{e.id}</td>
                              <td className="p-1">{e.entryNo}</td>
                              <td className="p-1">{e.entryDate}</td>
                              <td className="p-1">{e.reference}</td>
                              <td className="p-1 max-w-xs truncate">{e.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
