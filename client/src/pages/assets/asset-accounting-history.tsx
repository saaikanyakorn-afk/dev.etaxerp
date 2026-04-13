import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { formatDate, formatNumber } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Search, BookOpen, ChevronDown, ChevronRight } from "lucide-react";

export default function AssetAccountingHistory() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: journals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets/depreciation-journals", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/fixed-assets/depreciation-journals?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const normalized = useMemo(() => {
    return journals.map((j: any) => ({
      id: j.id,
      entryNo: j.entryNo || j.entry_no,
      entryDate: j.entryDate || j.entry_date,
      reference: j.reference,
      description: j.description,
      status: j.status,
      lines: j.lines || [],
    }));
  }, [journals]);

  const filtered = useMemo(() => {
    if (!search) return normalized;
    const s = search.toLowerCase();
    return normalized.filter((j: any) =>
      j.reference?.toLowerCase().includes(s) ||
      j.description?.toLowerCase().includes(s) ||
      j.entryNo?.toLowerCase().includes(s)
    );
  }, [normalized, search]);

  const totalAmount = filtered.reduce((sum: number, j: any) => {
    const debitTotal = (j.lines || []).reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
    return sum + debitTotal;
  }, 0);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: "var(--theme-primary)" }} />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ประวัติการลงบัญชี</h1>
          <Badge variant="outline" className="text-xs">{filtered.length} รายการ</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: "var(--theme-primary)" }} />
              <span className="text-sm text-muted-foreground">รวมค่าเสื่อมราคา</span>
            </div>
            <p className="text-xl font-bold mt-1" data-testid="text-total-dep">{formatNumber(totalAmount)}</p>
          </Card>
          <Card className="p-3 border-green-200 bg-green-50">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">จำนวนรายการ</span>
              <span className="ml-auto text-lg font-bold text-green-600" data-testid="text-journal-count">{filtered.length}</span>
            </div>
          </Card>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ค้นหาอ้างอิง / รายละเอียด..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-search" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบประวัติการลงบัญชีค่าเสื่อมราคา</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "var(--theme-table-header)" }}>
                      <TableHead className="text-white text-xs font-normal w-8"></TableHead>
                      <TableHead className="text-white text-xs font-normal">วันที่</TableHead>
                      <TableHead className="text-white text-xs font-normal">เลขที่</TableHead>
                      <TableHead className="text-white text-xs font-normal">อ้างอิง</TableHead>
                      <TableHead className="text-white text-xs font-normal">รายละเอียด</TableHead>
                      <TableHead className="text-white text-xs font-normal text-right">เดบิต</TableHead>
                      <TableHead className="text-white text-xs font-normal text-right">เครดิต</TableHead>
                      <TableHead className="text-white text-xs font-normal text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((j: any) => {
                      const isExpanded = expandedIds.has(j.id);
                      const debitTotal = (j.lines || []).reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
                      const creditTotal = (j.lines || []).reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
                      return (
                        <>
                          <TableRow
                            key={j.id}
                            className="hover:bg-slate-50 cursor-pointer"
                            data-testid={`row-journal-${j.id}`}
                            onClick={() => toggleExpand(j.id)}
                          >
                            <TableCell className="text-center px-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(j.entryDate, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-sm">{j.entryNo}</TableCell>
                            <TableCell className="text-sm" style={{ color: "var(--theme-primary)" }}>{j.reference}</TableCell>
                            <TableCell className="text-sm">{j.description}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{formatNumber(debitTotal)}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{formatNumber(creditTotal)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="text-[9px] bg-green-100 text-green-700 border-green-300 px-2 py-0">
                                {j.status === "posted" ? "ผ่านรายการ" : j.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (j.lines || []).map((line: any, idx: number) => (
                            <TableRow key={`${j.id}-line-${idx}`} className="bg-gray-50">
                              <TableCell></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell colSpan={2} className="text-xs">{line.description}</TableCell>
                              <TableCell className="text-xs"></TableCell>
                              <TableCell className="text-xs text-right">{parseFloat(line.debit || "0") > 0 ? formatNumber(parseFloat(line.debit)) : "-"}</TableCell>
                              <TableCell className="text-xs text-right">{parseFloat(line.credit || "0") > 0 ? formatNumber(parseFloat(line.credit)) : "-"}</TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                    <TableRow className="bg-amber-50 font-bold hover:bg-amber-50">
                      <TableCell colSpan={5} className="text-sm text-right">รวมทั้งสิ้น</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalAmount)}</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalAmount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
