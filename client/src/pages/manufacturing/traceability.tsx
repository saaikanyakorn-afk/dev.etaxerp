import ManufacturingLayout from "@/components/manufacturing-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompanyContext } from "@/lib/company-context";

export default function TraceabilityPage() {
  const { selectedCompany } = useCompanyContext();
  const companyId = selectedCompany?.id;
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: results, isLoading } = useQuery({
    queryKey: ["/api/manufacturing-module/traceability", companyId, search],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/manufacturing-module/traceability?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && search.length >= 2,
  });

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <ManufacturingLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-6 h-6" style={{ color: "#03c9d7" }} />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">ตรวจสอบย้อนกลับ (Traceability)</h1>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหา Serial Number ของสินค้าสำเร็จรูป หรือ ชิ้นส่วน..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 text-base" data-testid="input-search-trace"
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
        ) : !results?.length && search.length >= 2 ? (
          <div className="text-center text-gray-400 py-12" data-testid="text-no-results">ไม่พบข้อมูล Traceability สำหรับ "{search}"</div>
        ) : results?.length > 0 ? (
          <div className="space-y-3">
            {results.map((item: any) => {
              const isExpanded = expandedIds.has(item.fgSerialId);
              return (
                <Card key={item.fgSerialId} data-testid={`card-trace-${item.fgSerialId}`}>
                  <CardContent className="p-4">
                    <button
                      onClick={() => toggleExpand(item.fgSerialId)}
                      className="w-full flex items-center justify-between"
                      data-testid={`btn-expand-${item.fgSerialId}`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        <div className="text-left">
                          <div className="font-mono font-bold text-lg" style={{ color: "#03c9d7" }}>{item.fgSerialNumber}</div>
                          <div className="text-sm text-gray-500">{item.fgProductCode} — {item.fgProductName}</div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>ช่างประกอบ: <span className="font-medium">{item.operatorName || "-"}</span></div>
                        <div>QC: <span className="font-medium">{item.qcName || "-"}</span></div>
                        <div className="text-gray-400">{item.assembledAt ? new Date(item.assembledAt).toLocaleString("th-TH") : ""}</div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 border-t pt-3">
                        <div className="text-sm font-medium mb-2">ชิ้นส่วนที่ใช้ประกอบ ({item.components?.length || 0} รายการ)</div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serial Number</TableHead>
                              <TableHead>รหัสสินค้า</TableHead>
                              <TableHead>ชื่อสินค้า</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(item.components || []).map((c: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{c.serialNumber}</TableCell>
                                <TableCell className="font-mono text-gray-500">{c.productCode}</TableCell>
                                <TableCell>{c.productName}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </ManufacturingLayout>
  );
}
