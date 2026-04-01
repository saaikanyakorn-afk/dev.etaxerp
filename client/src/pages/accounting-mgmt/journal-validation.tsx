import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Search, Loader2, ArrowLeft, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function JournalValidation() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/journal-validation", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/journal-validation?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: false,
  });

  const handleRun = () => { setRan(true); refetch(); };

  const issueTypeLabel: Record<string, { label: string; color: string }> = {
    unbalanced: { label: "Dr/Cr ไม่เท่ากัน", color: "bg-red-100 text-red-700" },
    no_lines: { label: "ไม่มีรายการ", color: "bg-amber-100 text-amber-700" },
    no_reference: { label: "ไม่มีเอกสาร", color: "bg-blue-100 text-blue-700" },
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <Search className="h-5 w-5 text-[#03c9d7]" />
          <h1 className="text-xl font-heading font-bold">ตรวจสอบการลงบัญชี</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">ตรวจสอบรายการบัญชีทั้งหมด เช่น Dr/Cr ไม่เท่ากัน, ขาดเอกสารอ้างอิง</p>
              <Button onClick={handleRun} disabled={isLoading} data-testid="btn-run">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />} ตรวจสอบ
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ran && data && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {data.issueCount === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">ไม่พบปัญหา ตรวจสอบ {data.totalEntries} รายการ</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">พบปัญหา {data.issueCount} รายการ จาก {data.totalEntries} รายการ</span>
                    </div>
                  )}
                </div>

                {data.issues?.length > 0 && (
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left p-2">ประเภท</th>
                          <th className="text-left p-2">เลขที่</th>
                          <th className="text-left p-2">วันที่</th>
                          <th className="text-left p-2">รายละเอียด</th>
                          <th className="text-left p-2">ปัญหา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.issues.map((issue: any, i: number) => {
                          const typeInfo = issueTypeLabel[issue.type] || { label: issue.type, color: "bg-gray-100" };
                          return (
                            <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="p-2"><Badge className={typeInfo.color}>{typeInfo.label}</Badge></td>
                              <td className="p-2 font-mono">{issue.entryNo}</td>
                              <td className="p-2">{issue.entryDate}</td>
                              <td className="p-2 max-w-xs truncate">{issue.description}</td>
                              <td className="p-2 text-red-600">{issue.detail}</td>
                            </tr>
                          );
                        })}
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
