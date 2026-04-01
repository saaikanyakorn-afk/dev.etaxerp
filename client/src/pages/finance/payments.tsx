import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowDownCircle, ArrowUpCircle, CreditCard, Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PaymentItem = {
  id: number;
  type: "receive" | "payment";
  docNo: string;
  docDate: string;
  contactName: string;
  totalAmount: number;
  withholdingTax: number;
  paymentMethod: string | null;
  paymentDate: string | null;
  status: string;
  notes: string | null;
  refDoc: string | null;
  linkedDocs: { docType: string; docNo: string; amount: number }[];
};

export default function PaymentsPage() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ payments: PaymentItem[]; summary: { totalReceived: number; totalPaid: number; count: number } }>({
    queryKey: ["/api/finance/payments", companyId],
    queryFn: async () => {
      if (!companyId) return { payments: [], summary: { totalReceived: 0, totalPaid: 0, count: 0 } };
      const r = await fetch(`/api/finance/payments?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return { payments: [], summary: { totalReceived: 0, totalPaid: 0, count: 0 } };
      return r.json();
    },
    enabled: !!companyId,
  });

  const payments = data?.payments || [];
  const summary = data?.summary || { totalReceived: 0, totalPaid: 0, count: 0 };

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (typeFilter === "receive" && p.type !== "receive") return false;
      if (typeFilter === "payment" && p.type !== "payment") return false;
      if (search) {
        const q = search.toLowerCase();
        return p.docNo.toLowerCase().includes(q) || p.contactName.toLowerCase().includes(q) || (p.paymentMethod || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [payments, typeFilter, search]);

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <Layout title="รายการชำระเงิน">
      <div className="space-y-4 w-full overflow-x-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card data-testid="card-summary-received">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ArrowDownCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">รับเงินทั้งหมด</p>
                <p className="text-lg font-bold text-green-600" data-testid="text-total-received">฿{fmt(summary.totalReceived)}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-summary-paid">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <ArrowUpCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">จ่ายเงินทั้งหมด</p>
                <p className="text-lg font-bold text-red-600" data-testid="text-total-paid">฿{fmt(summary.totalPaid)}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-summary-count">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
                <p className="text-lg font-bold" data-testid="text-total-count">{summary.count} รายการ</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <CardTitle className="text-base">รายการชำระเงิน</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาเลขที่ / ชื่อ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                    data-testid="input-search-payments"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36 h-9" data-testid="select-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="receive">รับเงิน (RC)</SelectItem>
                    <SelectItem value="payment">จ่ายเงิน (PV)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CreditCard className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">ไม่มีรายการชำระเงิน</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>เลขที่</TableHead>
                      <TableHead>วันที่</TableHead>
                      <TableHead>คู่ค้า/ลูกค้า</TableHead>
                      <TableHead>วิธีชำระ</TableHead>
                      <TableHead className="text-right">จำนวนเงิน</TableHead>
                      <TableHead className="text-right">ภาษีหัก ณ ที่จ่าย</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const key = `${p.type}-${p.id}`;
                      const isExpanded = expanded.has(key);
                      const hasLinked = p.linkedDocs.length > 0;
                      return (
                        <>
                          <TableRow key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => hasLinked && toggleExpand(key)} data-testid={`row-payment-${key}`}>
                            <TableCell className="w-8 px-2">
                              {hasLinked ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                            </TableCell>
                            <TableCell>
                              {p.type === "receive" ? (
                                <Badge className="bg-green-100 text-green-700 border-0 text-xs" data-testid={`badge-type-${key}`}>
                                  <ArrowDownCircle className="h-3 w-3 mr-1" />รับเงิน
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs" data-testid={`badge-type-${key}`}>
                                  <ArrowUpCircle className="h-3 w-3 mr-1" />จ่ายเงิน
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-sm" data-testid={`text-docno-${key}`}>{p.docNo}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-date-${key}`}>{formatDate(p.docDate, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" data-testid={`text-contact-${key}`}>{p.contactName}</TableCell>
                            <TableCell className="text-sm">{p.paymentMethod || "-"}</TableCell>
                            <TableCell className={`text-right font-medium text-sm ${p.type === "receive" ? "text-green-600" : "text-red-600"}`} data-testid={`text-amount-${key}`}>
                              {p.type === "receive" ? "+" : "-"}฿{fmt(p.totalAmount)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {p.withholdingTax > 0 ? `฿${fmt(p.withholdingTax)}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.status === "approved" ? "default" : "secondary"} className="text-xs" data-testid={`badge-status-${key}`}>
                                {p.status === "approved" ? "อนุมัติ" : p.status === "draft" ? "แบบร่าง" : p.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && p.linkedDocs.map((ld, i) => (
                            <TableRow key={`${key}-ld-${i}`} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell colSpan={2} className="text-xs text-muted-foreground pl-6">
                                <FileText className="h-3 w-3 inline mr-1" />
                                {ld.docType} {ld.docNo}
                              </TableCell>
                              <TableCell colSpan={3}></TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">฿{fmt(ld.amount)}</TableCell>
                              <TableCell colSpan={2}></TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
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
