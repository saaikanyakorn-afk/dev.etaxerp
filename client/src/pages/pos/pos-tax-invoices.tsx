import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, FileText, Eye, Printer, Receipt, Calendar, Box } from "lucide-react";
import { formatDate } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";
import { useDateSettings } from "@/hooks/use-date-settings";

export default function PosTaxInvoices() {
  const { selectedCompanyId } = useCompany();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { calendarType } = useDateSettings();
  const today = toLocalDateStr(new Date());
  const monthAgo = toLocalDateStr(new Date(Date.now() - 30 * 86400000));
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["/api/pos/sales", selectedCompanyId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const r = await fetch(`/api/pos/sales?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : data.transactions || [];
    },
    enabled: !!selectedCompanyId,
  });

  const invoices = sales.filter((s: any) => s.taxInvoiceId || s.invoiceNumber);

  const filtered = invoices.filter((inv: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoiceNumber?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q) || inv.receiptNo?.toLowerCase().includes(q);
  });

  const totalAmount = filtered.reduce((s: number, inv: any) => s + Number(inv.totalAmount || inv.total || 0), 0);
  const totalVat = filtered.reduce((s: number, inv: any) => s + Number(inv.vatAmount || 0), 0);

  return (
    <PosLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-6 h-6 text-[#03c9d7]" /> ใบกำกับภาษี POS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">รายการใบกำกับภาษีจากการขายหน้าร้าน</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">จำนวนใบกำกับ</div>
              <div className="text-2xl font-bold text-slate-800" data-testid="text-total-invoices">{filtered.length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">ยอดรวม (รวม VAT)</div>
              <div className="text-2xl font-bold text-emerald-600" data-testid="text-total-amount">฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">ภาษีมูลค่าเพิ่ม (VAT)</div>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-total-vat">฿{totalVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="ค้นหาเลขที่ใบกำกับ, ชื่อลูกค้า..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
              </div>
              <ThaiDateInput label="จาก" value={dateFrom} onChange={setDateFrom} calendarType={calendarType} data-testid="input-date-from" />
              <ThaiDateInput label="ถึง" value={dateTo} onChange={setDateTo} calendarType={calendarType} data-testid="input-date-to" />
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Box className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>ไม่พบใบกำกับภาษี</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>เลขที่ใบกำกับ</TableHead>
                      <TableHead>วันที่</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>สาขา</TableHead>
                      <TableHead className="text-right">ยอดรวม</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-center">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv: any, i: number) => (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell className="text-slate-400 text-sm">{i + 1}</TableCell>
                        <TableCell className="font-mono font-medium text-blue-700">{inv.invoiceNumber || inv.receiptNo || "-"}</TableCell>
                        <TableCell className="text-sm">{inv.createdAt ? formatDate(inv.createdAt) : "-"}</TableCell>
                        <TableCell className="text-sm">{inv.customerName || "ลูกค้าทั่วไป"}</TableCell>
                        <TableCell className="text-sm">{inv.branchName || inv.storeName || "-"}</TableCell>
                        <TableCell className="text-right font-medium">฿{Number(inv.totalAmount || inv.total || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-sm">฿{Number(inv.vatAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          {inv.status === "cancelled" || inv.isVoid
                            ? <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">ยกเลิก</Badge>
                            : <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">ออกแล้ว</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setLocation(`/pos/invoice/${inv.taxInvoiceId || inv.id}`)} data-testid={`button-view-${inv.id}`}>
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
